"""Private Windows native-entry supervisor (not a Hermes entry point).

The supervisor stays OUTSIDE its private Job. CreateProcess assigns the Job
atomically via STARTUPINFOEX (Windows 10+), and only ActiveProcesses == 0
plus direct-process exit and drained pipes permits the final closed frame.
No PID lookup, taskkill, breakaway, shell, raw output, or lock removal.
"""
import ctypes
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import threading
import time

# Reuse the existing reviewed Win32 structure layout without running its host.
_spec = importlib.util.spec_from_file_location('p2_job_types', Path(__file__).with_name('windows-job-host.py'))
assert _spec is not None and _spec.loader is not None
_job_types = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_job_types)
ExtendedLimits = _job_types.ExtendedLimits


DWORD = ctypes.c_uint32
HANDLE = ctypes.c_void_p


class StartupInfo(ctypes.Structure):
    _fields_ = [('cb', DWORD), ('reserved', ctypes.c_wchar_p),
                ('desktop', ctypes.c_wchar_p), ('title', ctypes.c_wchar_p),
                ('x', DWORD), ('y', DWORD), ('xsize', DWORD), ('ysize', DWORD),
                ('xchars', DWORD), ('ychars', DWORD), ('fill', DWORD),
                ('flags', DWORD), ('show', ctypes.c_uint16),
                ('reserved_size', ctypes.c_uint16), ('reserved_bytes', HANDLE),
                ('stdin', HANDLE), ('stdout', HANDLE), ('stderr', HANDLE)]


class ProcessInfo(ctypes.Structure):
    _fields_ = [('process', HANDLE), ('thread', HANDLE),
                ('pid', DWORD), ('tid', DWORD)]


class StartupInfoEx(ctypes.Structure):
    _fields_ = [('startup', StartupInfo), ('attributes', HANDLE)]


class Accounting(ctypes.Structure):
    _fields_ = [('user', ctypes.c_int64), ('kernel', ctypes.c_int64),
                ('period_user', ctypes.c_int64), ('period_kernel', ctypes.c_int64),
                ('faults', DWORD), ('total', DWORD), ('active', DWORD),
                ('terminated', DWORD)]


def kernel_api():
    kernel = getattr(ctypes, 'WinDLL')('kernel32', use_last_error=True)
    signatures = {
        'CreateJobObjectW': ([HANDLE, ctypes.c_wchar_p], HANDLE),
        'SetInformationJobObject': ([HANDLE, ctypes.c_int, HANDLE, DWORD], ctypes.c_int),

        'TerminateJobObject': ([HANDLE, ctypes.c_uint], ctypes.c_int),
        'QueryInformationJobObject': ([HANDLE, ctypes.c_int, HANDLE, DWORD, HANDLE], ctypes.c_int),
        'CreateProcessW': ([ctypes.c_wchar_p, ctypes.c_wchar_p, HANDLE, HANDLE,
                            ctypes.c_int, DWORD, HANDLE, ctypes.c_wchar_p,
                            HANDLE, ctypes.POINTER(ProcessInfo)], ctypes.c_int),
        'InitializeProcThreadAttributeList': ([HANDLE, DWORD, DWORD, ctypes.POINTER(ctypes.c_size_t)], ctypes.c_int),
        'UpdateProcThreadAttribute': ([HANDLE, DWORD, ctypes.c_size_t, HANDLE, ctypes.c_size_t, HANDLE, HANDLE], ctypes.c_int),
        'DeleteProcThreadAttributeList': ([HANDLE], None),
        'WaitForSingleObject': ([HANDLE, DWORD], DWORD),
        'GetExitCodeProcess': ([HANDLE, ctypes.POINTER(DWORD)], ctypes.c_int),
        'TerminateProcess': ([HANDLE, ctypes.c_uint], ctypes.c_int),
        'CloseHandle': ([HANDLE], ctypes.c_int),
    }
    for name, (args, result) in signatures.items():
        function = getattr(kernel, name)
        function.argtypes, function.restype = args, result
    return kernel


def create_contained_process(kernel, job, startup, info, executable, command, flags, environment, cwd, handles):
    # Assigning AFTER a suspended spawn can orphan it if this host dies in the
    # gap. JOB_LIST assigns during CreateProcess, before any child code runs.
    # There is deliberately no older-Windows or uncontained fallback.
    count = 2 if handles else 1
    size = ctypes.c_size_t()
    kernel.InitializeProcThreadAttributeList(None, count, 0, ctypes.byref(size))
    if not size.value or size.value > 65536:
        raise RuntimeError('NATIVE_ATTRIBUTES_FAILED')
    storage = ctypes.create_string_buffer(size.value)
    if not kernel.InitializeProcThreadAttributeList(storage, count, 0, ctypes.byref(size)):
        raise RuntimeError('NATIVE_ATTRIBUTES_FAILED')
    try:
        jobs = (HANDLE * 1)(job)
        if not kernel.UpdateProcThreadAttribute(storage, 0, 0x2000D, jobs, ctypes.sizeof(jobs), None, None):
            raise RuntimeError('NATIVE_CONTAINMENT_FAILED')
        if handles:
            inherited = (HANDLE * len(handles))(*handles)
            if not kernel.UpdateProcThreadAttribute(storage, 0, 0x20002, inherited, ctypes.sizeof(inherited), None, None):
                raise RuntimeError('NATIVE_HANDLE_LIST_FAILED')
        extended = StartupInfoEx(startup=startup, attributes=ctypes.cast(storage, HANDLE))
        extended.startup.cb = ctypes.sizeof(extended)
        if not kernel.CreateProcessW(executable, command, None, None, bool(handles), flags | 0x80000,
                                     environment, cwd, ctypes.byref(extended), ctypes.byref(info)):
            raise RuntimeError('NATIVE_SPAWN_FAILED')
    finally:
        kernel.DeleteProcThreadAttributeList(storage)


def job_empty(kernel, job):
    accounting = Accounting()
    if not kernel.QueryInformationJobObject(job, 1, ctypes.byref(accounting),
                                           ctypes.sizeof(accounting), None):
        raise RuntimeError('NATIVE_QUERY_FAILED')
    return accounting.active == 0


def watch_parent(fd, stop):
    try:
        while os.read(fd, 1):
            pass
    except OSError:
        pass
    stop.set()


def drain(fd, port_callback, failed):
    # Arbitrary Hermes/tool output is discarded, never relayed or logged.
    buffer = b''
    dropping = False
    try:
        while True:
            chunk = os.read(fd, 4096)
            if not chunk:
                return
            for part in chunk.splitlines(keepends=True):
                complete = part.endswith(b'\n')
                if not dropping:
                    buffer += part
                    if len(buffer) > 4096:
                        dropping = True
                        buffer = b''
                if complete:
                    if not dropping and port_callback:
                        match = re.fullmatch(rb'HERMES_(?:DASHBOARD|BACKEND)_READY port=([0-9]{1,5})\r?\n', buffer)
                        if match and 0 < int(match[1]) < 65536:
                            port_callback(int(match[1]))
                    dropping, buffer = False, b''
    except OSError:
        failed.set()
    finally:
        os.close(fd)


def supervise(mode, args):
    import msvcrt
    get_handle = getattr(msvcrt, 'get_osfhandle')
    set_inheritable = getattr(os, 'set_handle_inheritable')
    kernel = kernel_api()
    job = kernel.CreateJobObjectW(None, None)
    if not job:
        raise RuntimeError('NATIVE_JOB_FAILED')
    info = ProcessInfo()
    readers, fds, child_fds = [], [], []
    stop, reader_failed = threading.Event(), threading.Event()
    output_lock = threading.Lock()
    port_sent = False

    def emit(event, **fields):
        with output_lock:
            sys.stdout.write(json.dumps({'event': event, **fields}, separators=(',', ':')) + '\n')
            sys.stdout.flush()

    def port_ready(port):
        nonlocal port_sent
        if not port_sent:
            port_sent = True
            emit('port', port=port)

    try:
        limits = ExtendedLimits()
        limits.BasicLimitInformation.LimitFlags = 0x2000
        if not kernel.SetInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
            raise RuntimeError('NATIVE_JOB_LIMIT_FAILED')
        # Never let the child inherit manager supervision/protocol handles.
        for stream in (sys.stdin, sys.stdout, sys.stderr):
            set_inheritable(get_handle(stream.fileno()), False)
        startup = StartupInfo()
        startup.cb = ctypes.sizeof(startup)
        flags = 0x400  # CREATE_UNICODE_ENVIRONMENT
        if mode == 'cli':
            flags |= 0x10  # CREATE_NEW_CONSOLE; no inherited standard handles.
        else:
            flags |= 0x08000000  # CREATE_NO_WINDOW
            startup.flags = 0x100  # STARTF_USESTDHANDLES
            input_fd = os.open(os.devnull, os.O_RDONLY)
            child_fds.append(input_fd)
            startup.stdin = get_handle(input_fd)
            for attr in ('stdout', 'stderr'):
                read_fd, write_fd = os.pipe()
                fds.append(read_fd)
                child_fds.append(write_fd)
                setattr(startup, attr, get_handle(write_fd))
            for fd in child_fds:
                set_inheritable(get_handle(fd), True)
        environment = ctypes.create_unicode_buffer('\0'.join(
            key + '=' + value for key, value in sorted(os.environ.items(), key=lambda item: item[0].upper())
        ) + '\0\0')
        command = ctypes.create_unicode_buffer(subprocess.list2cmdline([sys.executable, *args]))
        create_contained_process(kernel, job, startup, info, sys.executable, command,
                                 flags, environment, os.getcwd(), [get_handle(fd) for fd in child_fds])
        kernel.CloseHandle(info.thread)
        info.thread = None
        for fd in child_fds:
            os.close(fd)
        child_fds.clear()
        emit('started')
        while fds:
            fd = fds.pop(0)
            callback = port_ready if not readers else None
            thread = threading.Thread(target=drain, args=(fd, callback, reader_failed), daemon=True)
            readers.append(thread)
            thread.start()
        threading.Thread(target=watch_parent, args=(sys.stdin.fileno(), stop), daemon=True).start()
        while not stop.wait(0.025):
            result = kernel.WaitForSingleObject(info.process, 0)
            if result == 0:
                break
            if result != 258 or reader_failed.is_set():
                raise RuntimeError('NATIVE_WAIT_FAILED')
        exit_code = DWORD(104)
        if kernel.WaitForSingleObject(info.process, 0) == 0:
            if not kernel.GetExitCodeProcess(info.process, ctypes.byref(exit_code)):
                raise RuntimeError('NATIVE_EXIT_CODE_FAILED')
        # Direct exit does not mean descendants exited. Terminate only this Job.
        if not kernel.TerminateJobObject(job, 104):
            raise RuntimeError('NATIVE_STOP_FAILED')
        deadline = time.monotonic() + 10
        while not job_empty(kernel, job):
            if time.monotonic() >= deadline:
                raise RuntimeError('NATIVE_TREE_UNCONFIRMED')
            time.sleep(0.025)
        if kernel.WaitForSingleObject(info.process, 1000) != 0:
            raise RuntimeError('NATIVE_DIRECT_EXIT_UNCONFIRMED')
        for thread in readers:
            thread.join(timeout=max(0, deadline - time.monotonic()))
            if thread.is_alive():
                raise RuntimeError('NATIVE_OUTPUT_UNCONFIRMED')
        if reader_failed.is_set():
            raise RuntimeError('NATIVE_OUTPUT_FAILED')
        emit('closed', treeExited=True, exitCode=exit_code.value)
        return 0
    except (OSError, RuntimeError):
        # Terminate the exact CreateProcess handle and Job, never a discovered
        # PID. Failure cleanup is conservative: it never emits a closed proof.
        if info.process:
            kernel.TerminateProcess(info.process, 103)
            kernel.WaitForSingleObject(info.process, 1000)
        kernel.TerminateJobObject(job, 103)
        try:
            emit('failed')
        except OSError:
            pass
        return 103
    finally:
        for fd in child_fds + fds:
            os.close(fd)
        for handle in (info.thread, info.process, job):
            if handle:
                kernel.CloseHandle(handle)


def main():
    if os.name != 'nt' or len(sys.argv) < 4 or sys.argv[1] not in ('cli', 'dashboard') or sys.argv[2] != '--':
        return 2
    return supervise(sys.argv[1], sys.argv[3:])


if __name__ == '__main__':
    raise SystemExit(main())
