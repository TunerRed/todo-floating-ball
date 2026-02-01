package platform

import (
	"syscall"
	"unsafe"
)

var (
	user32 = syscall.NewLazyDLL("user32.dll")

	procFindWindowW         = user32.NewProc("FindWindowW")
	procSetWindowLongW      = user32.NewProc("SetWindowLongW")
	procGetWindowLongW      = user32.NewProc("GetWindowLongW")
	procSetWindowPos        = user32.NewProc("SetWindowPos")
	procGetWindowRect       = user32.NewProc("GetWindowRect")
	procGetSystemMetrics    = user32.NewProc("GetSystemMetrics")
	procSendMessageW        = user32.NewProc("SendMessageW")
	procLoadImageW          = user32.NewProc("LoadImageW")
	procSetWindowRgn        = user32.NewProc("SetWindowRgn")
	procShowWindow          = user32.NewProc("ShowWindow")
	procSetForegroundWindow = user32.NewProc("SetForegroundWindow")
	procMonitorFromWindow   = user32.NewProc("MonitorFromWindow")
	procGetMonitorInfoW     = user32.NewProc("GetMonitorInfoW")
	procCreatePopupMenu     = user32.NewProc("CreatePopupMenu")
	procAppendMenuW         = user32.NewProc("AppendMenuW")
	procTrackPopupMenu      = user32.NewProc("TrackPopupMenu")
	procDestroyMenu         = user32.NewProc("DestroyMenu")
	procGetCursorPos        = user32.NewProc("GetCursorPos")
	procGetAsyncKeyState    = user32.NewProc("GetAsyncKeyState")

	gdi32                 = syscall.NewLazyDLL("gdi32.dll")
	procCreateEllipticRgn = gdi32.NewProc("CreateEllipticRgn")

	kernel32                = syscall.NewLazyDLL("kernel32.dll")
	procCreateMutexW        = kernel32.NewProc("CreateMutexW")
	procGetLastError        = kernel32.NewProc("GetLastError")
	procCreateEventW        = kernel32.NewProc("CreateEventW")
	procOpenEventW          = kernel32.NewProc("OpenEventW")
	procSetEvent            = kernel32.NewProc("SetEvent")
	procWaitForSingleObject = kernel32.NewProc("WaitForSingleObject")
	procCloseHandle         = kernel32.NewProc("CloseHandle")
)

const (
	ERROR_ALREADY_EXISTS = 183
	INFINITE             = 0xFFFFFFFF
	WAIT_OBJECT_0        = 0
	EVENT_ALL_ACCESS     = 0x1F0003
)

func CreateEvent(name string) (uintptr, error) {
	ptr, _ := syscall.UTF16PtrFromString(name)
	ret, _, err := procCreateEventW.Call(0, 0, 0, uintptr(unsafe.Pointer(ptr)))
	if ret == 0 {
		return 0, err
	}
	return ret, nil
}

func OpenEvent(name string) (uintptr, error) {
	ptr, _ := syscall.UTF16PtrFromString(name)
	ret, _, err := procOpenEventW.Call(uintptr(EVENT_ALL_ACCESS), 0, uintptr(unsafe.Pointer(ptr)))
	if ret == 0 {
		return 0, err
	}
	return ret, nil
}

func SetEvent(handle uintptr) error {
	ret, _, err := procSetEvent.Call(handle)
	if ret == 0 {
		return err
	}
	return nil
}

func WaitForSingleObject(handle uintptr, timeout uint32) (uint32, error) {
	ret, _, err := procWaitForSingleObject.Call(handle, uintptr(timeout))
	if ret == 0xFFFFFFFF {
		return 0xFFFFFFFF, err
	}
	return uint32(ret), nil
}

func CloseHandle(handle uintptr) error {
	ret, _, err := procCloseHandle.Call(handle)
	if ret == 0 {
		return err
	}
	return nil
}

func CreateMutex(name string) (uintptr, error) {
	ptr, _ := syscall.UTF16PtrFromString(name)
	ret, _, err := procCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(ptr)))

	if ret == 0 {
		return 0, err
	}

	lastErr, _, _ := procGetLastError.Call()
	if lastErr == ERROR_ALREADY_EXISTS {
		return ret, syscall.Errno(ERROR_ALREADY_EXISTS)
	}

	return ret, nil
}

const (
	GWL_STYLE        = -16
	GWL_EXSTYLE      = -20
	WS_CAPTION       = 0x00C00000
	WS_THICKFRAME    = 0x00040000
	WS_SYSMENU       = 0x00080000
	WS_EX_LAYERED    = 0x00080000
	WS_EX_TOOLWINDOW = 0x00000080
	WS_EX_APPWINDOW  = 0x00040000
	WS_POPUP         = 0x80000000

	SWP_NOSIZE       = 0x0001
	SWP_NOMOVE       = 0x0002
	SWP_NOZORDER     = 0x0004
	SWP_FRAMECHANGED = 0x0020

	HWND_TOPMOST = -1

	WM_SETICON = 0x0080
	ICON_SMALL = 0
	ICON_BIG   = 1

	IMAGE_ICON      = 1
	LR_LOADFROMFILE = 0x00000010
	LR_DEFAULTSIZE  = 0x00000040

	SW_SHOW    = 5
	SW_RESTORE = 9

	MONITOR_DEFAULTTONULL    = 0x00000000
	MONITOR_DEFAULTTOPRIMARY = 0x00000001
	MONITOR_DEFAULTTONEAREST = 0x00000002
)

type RECT struct {
	Left, Top, Right, Bottom int32
}

type MONITORINFO struct {
	CbSize    uint32
	RcMonitor RECT
	RcWork    RECT
	DwFlags   uint32
}

func FindWindow(title string) uintptr {
	ptr, _ := syscall.UTF16PtrFromString(title)
	ret, _, _ := procFindWindowW.Call(0, uintptr(unsafe.Pointer(ptr)))
	return ret
}

func MakeFrameless(hwnd uintptr) {
	index := int32(GWL_STYLE)
	style, _, _ := procGetWindowLongW.Call(hwnd, uintptr(index))
	style = style &^ (WS_CAPTION | WS_THICKFRAME | WS_SYSMENU)
	style = style | WS_POPUP
	procSetWindowLongW.Call(hwnd, uintptr(index), style)
	procSetWindowPos.Call(hwnd, 0, 0, 0, 0, 0,
		uintptr(SWP_NOMOVE|SWP_NOSIZE|SWP_NOZORDER|SWP_FRAMECHANGED))
}

func GetWindowRect(hwnd uintptr) *RECT {
	var rect RECT
	ret, _, _ := procGetWindowRect.Call(hwnd, uintptr(unsafe.Pointer(&rect)))
	if ret == 0 {
		return nil
	}
	return &rect
}

func SetWindowPos(hwnd uintptr, x, y, w, h int, flags uint) {
	procSetWindowPos.Call(hwnd, 0, uintptr(x), uintptr(y), uintptr(w), uintptr(h), uintptr(flags))
}

func SetWindowLong(hwnd uintptr, index int, value int) {
	procSetWindowLongW.Call(hwnd, uintptr(index), uintptr(value))
}

func SetWindowCircular(hwnd uintptr, width, height int) {
	hrgn, _, _ := procCreateEllipticRgn.Call(0, 0, uintptr(width), uintptr(height))
	if hrgn != 0 {
		procSetWindowRgn.Call(hwnd, hrgn, 1)
	}
}

func HideFromTaskbar(hwnd uintptr) {
	index := int32(GWL_EXSTYLE)
	style, _, _ := procGetWindowLongW.Call(hwnd, uintptr(index))

	// Remove APPWINDOW style if present
	style = style &^ WS_EX_APPWINDOW
	// Add TOOLWINDOW style
	style = style | WS_EX_TOOLWINDOW

	procSetWindowLongW.Call(hwnd, uintptr(index), style)
	procSetWindowPos.Call(hwnd, 0, 0, 0, 0, 0,
		uintptr(SWP_NOMOVE|SWP_NOSIZE|SWP_NOZORDER|SWP_FRAMECHANGED))
}

func SetTopMost(hwnd uintptr) {
	hwndTopMost := ^uintptr(0)
	procSetWindowPos.Call(hwnd, hwndTopMost, 0, 0, 0, 0,
		uintptr(SWP_NOMOVE|SWP_NOSIZE))
}

func SetWindowIcon(hwnd uintptr, iconPath string, iconType int) {
	ptr, _ := syscall.UTF16PtrFromString(iconPath)
	hIcon, _, _ := procLoadImageW.Call(
		0,
		uintptr(unsafe.Pointer(ptr)),
		uintptr(IMAGE_ICON),
		0, 0,
		uintptr(LR_LOADFROMFILE|LR_DEFAULTSIZE),
	)
	if hIcon != 0 {
		procSendMessageW.Call(hwnd, uintptr(WM_SETICON), uintptr(iconType), hIcon)
	}
}

func ShowNormal(hwnd uintptr) {
	procShowWindow.Call(hwnd, uintptr(SW_RESTORE))
}

func SetForegroundWindow(hwnd uintptr) {
	procSetForegroundWindow.Call(hwnd)
}

func PostQuitMessage(hwnd uintptr) {
	procSendMessageW.Call(hwnd, 0x0010, 0, 0) // WM_CLOSE
}

func GetMonitorRectForWindow(hwnd uintptr) (*RECT, error) {
	hMonitor, _, _ := procMonitorFromWindow.Call(hwnd, MONITOR_DEFAULTTONEAREST)
	if hMonitor == 0 {
		return nil, syscall.Errno(0)
	}

	var mi MONITORINFO
	mi.CbSize = uint32(unsafe.Sizeof(mi))
	ret, _, _ := procGetMonitorInfoW.Call(hMonitor, uintptr(unsafe.Pointer(&mi)))
	if ret == 0 {
		return nil, syscall.Errno(0)
	}
	return &mi.RcMonitor, nil
}

// Menu related constants and functions
const (
	MF_STRING       = 0x00000000
	MF_SEPARATOR    = 0x00000800
	TPM_TOPALIGN    = 0x0000
	TPM_LEFTALIGN   = 0x0000
	TPM_RETURNCMD   = 0x0100
	TPM_RIGHTBUTTON = 0x0002
	VK_LBUTTON      = 0x01
)

type POINT struct {
	X, Y int32
}

func GetCursorPos() (int, int) {
	var pt POINT
	procGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))
	return int(pt.X), int(pt.Y)
}

func GetAsyncKeyState(vKey int) uint16 {
	ret, _, _ := procGetAsyncKeyState.Call(uintptr(vKey))
	return uint16(ret)
}

func CreatePopupMenu() uintptr {
	ret, _, _ := procCreatePopupMenu.Call()
	return ret
}

func AppendMenu(hMenu uintptr, uFlags uint32, uIDNewItem uintptr, lpNewItem string) bool {
	var ptr *uint16
	if lpNewItem != "" {
		ptr, _ = syscall.UTF16PtrFromString(lpNewItem)
	}
	ret, _, _ := procAppendMenuW.Call(hMenu, uintptr(uFlags), uIDNewItem, uintptr(unsafe.Pointer(ptr)))
	return ret != 0
}

func TrackPopupMenu(hMenu uintptr, uFlags uint32, x, y int, nReserved int, hWnd uintptr, prcRect uintptr) int {
	ret, _, _ := procTrackPopupMenu.Call(hMenu, uintptr(uFlags), uintptr(x), uintptr(y), uintptr(nReserved), hWnd, prcRect)
	return int(ret)
}

func DestroyMenu(hMenu uintptr) bool {
	ret, _, _ := procDestroyMenu.Call(hMenu)
	return ret != 0
}
