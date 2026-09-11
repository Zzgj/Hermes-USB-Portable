"""Own one Python child tree on Windows; never open or kill processes by name/PID.

The host joins a private kill-on-close job before creating children. Its job handle
is non-inheritable and intentionally lives until host process exit. Job assignment
failure aborts before Hermes starts; there is no uncontained fallback.
"""
import ctypes
import os
import subprocess
import sys
import threading


class BasicLimits(ctypes.Structure):
    _fields_ = [
        ('PerProcessUserTimeLimit', ctypes.c_int64),
        ('PerJobUserTimeLimit', ctypes.c_int64),
        ('LimitFlags', ctypes.c_uint32),
        ('MinimumWorkingSetSize', ctypes.c_size_t),
        ('MaximumWorkingSetSize', ctypes.c_size_t),
        ('ActiveProcessLimit', ctypes.c_uint32),
        ('Affinity', ctypes.c_size_t),
        ('PriorityClass', ctypes.c_uint32),
        ('SchedulingClass', ctypes.c_uint32),
    ]


class IoCounters(ctypes.Structure):
    _fields_ = [(name, ctypes.c_uint64) for name in (
        'ReadOperationCount', 'WriteOperationCount', 'OtherOperationCount',
        'ReadTransferCount', 'WriteTransferCount', 'OtherTransferCount')]


class ExtendedLimits(ctypes.Structure):
    _fields_ = [
        ('BasicLimitInformation', BasicLimits), ('IoInfo', IoCounters),
        ('ProcessMemoryLimit', ctypes.c_size_t), ('JobMemoryLimit', ctypes.c_size_t),
        ('PeakProcessMemoryUsed', ctypes.c_size_t), ('PeakJobMemoryUsed', ctypes.c_size_t),
    ]


def contain_current_process():
    if os.name != 'nt':
        raise RuntimeError('WINDOWS_REQUIRED')
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p]
    kernel.CreateJobObjectW.restype = ctypes.c_void_p
    kernel.SetInformationJobObject.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32]
    kernel.SetInformationJobObject.restype = ctypes.c_int
    kernel.GetCurrentProcess.argtypes = []
    kernel.GetCurrentProcess.restype = ctypes.c_void_p
    kernel.AssignProcessToJobObject.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
    kernel.AssignProcessToJobObject.restype = ctypes.c_int
    kernel.CloseHandle.argtypes = [ctypes.c_void_p]
    kernel.CloseHandle.restype = ctypes.c_int
    job = kernel.CreateJobObjectW(None, None)
    if not job:
        raise RuntimeError('JOB_CREATE_FAILED')
    limits = ExtendedLimits()
    limits.BasicLimitInformation.LimitFlags = 0x00002000  # KILL_ON_JOB_CLOSE, no breakaway.
    if not kernel.SetInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
        kernel.CloseHandle(job)
        raise RuntimeError('JOB_LIMIT_FAILED')
    if not kernel.AssignProcessToJobObject(job, kernel.GetCurrentProcess()):
        kernel.CloseHandle(job)
        raise RuntimeError('JOB_ASSIGN_FAILED')
    return job


def main():
    if len(sys.argv) < 3 or sys.argv[1] != '--':
        return 2
    # Do not close this handle explicitly: the host is itself a member, and process
    # teardown must retain the child exit code while closing all OS handles.
    job = contain_current_process()
    def parent_watch():
        # Manager owns the only writer; parent crash closes it without a console event.
        while sys.stdin.buffer.read(1):
            pass
        os._exit(104)
    threading.Thread(target=parent_watch, daemon=True).start()
    child = subprocess.Popen([sys.executable, *sys.argv[2:]], stdin=subprocess.DEVNULL,
                             stdout=sys.stdout, stderr=sys.stderr, close_fds=True)
    try:
        return child.wait()
    finally:
        # Abrupt termination is handled by the OS job; normal completion exits host.
        assert job


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (RuntimeError, OSError):
        print('P2_WINDOWS_JOB_FAILED', file=sys.stderr)
        raise SystemExit(103)
