# Checks the visibility state of a Path of Exile window.
# Outputs exactly one of: 'visible' | 'background' | 'hidden'
#   visible    - PoE is running, not minimized, and is the foreground window
#   background - PoE is running, not minimized, but another app has focus
#   hidden     - PoE is not running or its window is minimized

$p = Get-Process -Name 'PathOfExile*' -ErrorAction SilentlyContinue

if (-not $p) {
    Write-Output 'hidden'
    exit
}

$handle = $p[0].MainWindowHandle

if ($handle -eq 0) {
    Write-Output 'hidden'
    exit
}

try {
    if (-not ([System.Management.Automation.PSTypeName]'PoeWinCheck').Type) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class PoeWinCheck {
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
'@
    }

    if ([PoeWinCheck]::IsIconic([IntPtr]$handle)) {
        Write-Output 'hidden'
        exit
    }

    $fg = [PoeWinCheck]::GetForegroundWindow()
    if ($fg -eq [IntPtr]$handle) {
        Write-Output 'visible'
    } else {
        Write-Output 'background'
    }
} catch {
    # If Win32 calls fail, fall back to visible whenever the handle exists
    Write-Output 'visible'
}
