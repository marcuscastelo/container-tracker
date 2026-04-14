export function createWindowLifecycleController(command) {
    let quitting = false;
    function openWindow(window) {
        if (window.isMinimized()) {
            window.restore();
        }
        if (!window.isVisible()) {
            window.show();
        }
        window.focus();
    }
    return {
        mode: command.mode,
        shouldOpenOnReady() {
            return command.mode !== 'tray';
        },
        setQuitting() {
            quitting = true;
        },
        handleWindowClose(event, window) {
            if (command.mode !== 'tray' || quitting) {
                return false;
            }
            event.preventDefault();
            window.hide();
            return true;
        },
        openWindow,
    };
}
export function setupSingleInstance(command) {
    const hasLock = command.app.requestSingleInstanceLock();
    if (!hasLock) {
        command.app.quit();
        return false;
    }
    command.app.on('second-instance', () => {
        command.onSecondInstance();
    });
    return true;
}
