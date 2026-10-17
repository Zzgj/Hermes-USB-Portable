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


def watch_parent(parent_fd):
    # Never hold a Python BufferedReader lock in a daemon at interpreter shutdown.
    # This dedicated manager pipe is not the business child's stdin.
    try:
        while os.read(parent_fd, 1):
            pass
    except OSError:
        # Loss of the supervision pipe is fail-closed, just like EOF.
        pass
    os._exit(104)


def parse_host_arguments(argv):
    # Internal launch protocol, never populated from arbitrary HTTP arguments.
    if len(argv) >= 4 and argv[1:3] == ['--console', '--']:
        return True, argv[3:]
    if len(argv) >= 3 and argv[1] == '--':
        return False, argv[2:]
    raise ValueError('INVALID_HOST_ARGUMENTS')


def main():
    try:
        console, child_args = parse_host_arguments(sys.argv)
    except ValueError:
        return 2
    # Do not close this handle explicitly: the host is itself a member, and process
    # teardown must retain the child exit code while closing all OS handles.
    job = contain_current_process()
    parent_fd = sys.stdin.fileno()
    threading.Thread(target=watch_parent, args=(parent_fd,), daemon=True).start()
    # A new console belongs to the child, while the host retains the manager pipe.
    # Do not forward the supervision pipe as interactive standard input.
    options = ({'creationflags': subprocess.CREATE_NEW_CONSOLE}
               if console else {'stdin': subprocess.DEVNULL,
                                'stdout': sys.stdout, 'stderr': sys.stderr})
    child = subprocess.Popen([sys.executable, *child_args], close_fds=True, **options)
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
