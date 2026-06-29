/**
 * Sergio.v95 Portfolio Engine
 * Dynamic interactivity & Windows 95 behavior manager
 */

let zIndex = 100;
let draggedElement = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let activeWindows = ['profileWindow'];

// Screensaver state
let idleTime = 0;
let screensaverActive = false;
let screensaverCanvas = null;
let screensaverCtx = null;
let screensaverAnimFrame = null;
let screensaverItems = [];

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Start system clock
    updateClock();
    setInterval(updateClock, 1000);

    // Setup idle timer for screensaver (15 seconds)
    ['mousemove', 'mousedown', 'keydown', 'click', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, resetIdleTimer, true);
    });

    setInterval(function() {
        idleTime++;
        if (idleTime >= 15 && !screensaverActive) {
            startScreensaver();
        }
    }, 1000);

    // Bind desktop icon actions
    document.querySelectorAll('.desktop-icon').forEach(icon => {
        icon.addEventListener('click', function(e) {
            selectIcon(this);
            e.stopPropagation();
        });
        
        icon.addEventListener('dblclick', function() {
            const windowId = this.getAttribute('data-window');
            if (windowId) openWindow(windowId);
        });
    });

    // Bind start menu items
    document.querySelectorAll('.start-menu-item').forEach(item => {
        item.addEventListener('click', function() {
            const windowId = this.getAttribute('data-window');
            const dialogId = this.getAttribute('data-dialog');
            
            if (windowId) {
                openWindow(windowId);
            } else if (dialogId) {
                showDialog(dialogId);
            }
            toggleStartMenu();
        });
    });

    // Wire window control buttons dynamically
    document.querySelectorAll('.window').forEach(win => {
        const winId = win.id;
        const minBtn = win.querySelector('.window-controls .window-btn:nth-child(1)');
        const maxBtn = win.querySelector('.window-controls .window-btn:nth-child(2)');
        const closeBtn = win.querySelector('.window-controls .window-btn:nth-child(3)');
        
        if (minBtn) minBtn.addEventListener('click', () => minimizeWindow(winId));
        if (maxBtn) maxBtn.addEventListener('click', () => maximizeWindow(winId));
        if (closeBtn) closeBtn.addEventListener('click', () => closeWindow(winId));
        
        // Also wire any 'Close' button inside content
        const contentCloseBtn = win.querySelector('.window-content button.btn:not(.btn-primary)');
        if (contentCloseBtn && contentCloseBtn.textContent.trim().toLowerCase() === 'close') {
            contentCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeWindow(winId);
            });
        }
    });

    // Wire dialog control buttons
    document.querySelectorAll('.dialog-box').forEach(dialog => {
        const dialogId = dialog.id;
        const titleCloseBtn = dialog.querySelector('.window-titlebar > .window-btn');
        if (titleCloseBtn) {
            titleCloseBtn.addEventListener('click', () => closeDialog(dialogId));
        }

        dialog.querySelectorAll('.dialog-content button').forEach(btn => {
            btn.addEventListener('click', () => closeDialog(dialogId));
        });
    });

    // Wire special interactive elements (like the About button in profile window)
    const aboutBtn = document.querySelector('#profileWindow button.btn-primary');
    if (aboutBtn) {
        aboutBtn.addEventListener('click', () => showDialog('aboutDialog'));
    }

    // Wire portfolio contact link specifically (the rest are direct external links)
    const portfolioLink = document.getElementById('portfolioContactLink');
    if (portfolioLink) {
        portfolioLink.addEventListener('click', function(e) {
            e.preventDefault();
            showDialog('portfolioDialog');
        });
    }

    // Click outside handler for start menu and desktop deselect
    document.addEventListener('click', function(e) {
        const startMenu = document.getElementById('startMenu');
        const startBtn = document.getElementById('startBtn');
        
        if (startMenu && startBtn && !startMenu.contains(e.target) && !startBtn.contains(e.target)) {
            startMenu.classList.remove('active');
            startBtn.classList.remove('active');
        }
        
        if (e.target.classList.contains('desktop')) {
            document.querySelectorAll('.desktop-icon').forEach(icon => {
                icon.classList.remove('selected');
            });
        }
    });

    // Escape key closes active dialogs
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.dialog-box').forEach(dialog => {
                dialog.classList.remove('active');
            });
        }
    });

    // Start drag event listener
    document.addEventListener('mousedown', function(e) {
        const titlebar = e.target.closest('.window-titlebar');
        if (!titlebar) return;
        
        // Ignore if clicking window buttons
        if (e.target.closest('.window-btn') || e.target.closest('button')) return;
        
        const win = titlebar.closest('.window, .dialog-box');
        if (!win) return;
        
        draggedElement = win;
        const rect = win.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        
        bringToFront(win.id);
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
    });

    // Render initially active windows in the taskbar
    activeWindows.forEach(winId => {
        addToTaskbar(winId);
    });
}

// Clock updates
function updateClock() {
    const now = new Date();
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    
    // Formatting: Lunes, 29 de Junio de 2026 - 10:02 AM
    const clockStr = `${dayName}, ${day} de ${monthName} de ${year} - ${hours}:${minutes} ${ampm}`;
    const clockEl = document.getElementById('clock');
    if (clockEl) {
        clockEl.textContent = clockStr;
    }
}

// Window Operations
function openWindow(windowId) {
    const windowEl = document.getElementById(windowId);
    if (!windowEl) return;
    
    windowEl.classList.add('active');
    bringToFront(windowId);
    
    if (!activeWindows.includes(windowId)) {
        activeWindows.push(windowId);
        addToTaskbar(windowId);
    }
}

function closeWindow(windowId) {
    const windowEl = document.getElementById(windowId);
    if (!windowEl) return;
    
    windowEl.classList.remove('active');
    activeWindows = activeWindows.filter(w => w !== windowId);
    removeFromTaskbar(windowId);
}

function minimizeWindow(windowId) {
    const windowEl = document.getElementById(windowId);
    if (!windowEl) return;
    
    windowEl.classList.remove('active');
    const taskbarItem = document.getElementById('taskbar-' + windowId);
    if (taskbarItem) {
        taskbarItem.classList.remove('active');
    }
}

function maximizeWindow(windowId) {
    const windowEl = document.getElementById(windowId);
    if (!windowEl) return;
    
    if (windowEl.style.width === '100%') {
        windowEl.style.width = windowEl.getAttribute('data-prev-width') || '500px';
        windowEl.style.height = windowEl.getAttribute('data-prev-height') || 'auto';
        windowEl.style.top = windowEl.getAttribute('data-prev-top') || '50px';
        windowEl.style.left = windowEl.getAttribute('data-prev-left') || '100px';
        windowEl.style.transform = '';
    } else {
        windowEl.setAttribute('data-prev-width', windowEl.style.width || '500px');
        windowEl.setAttribute('data-prev-height', windowEl.style.height || 'auto');
        const rect = windowEl.getBoundingClientRect();
        windowEl.setAttribute('data-prev-top', windowEl.style.top || (rect.top + 'px'));
        windowEl.setAttribute('data-prev-left', windowEl.style.left || (rect.left + 'px'));
        
        windowEl.style.width = '100%';
        windowEl.style.height = 'calc(100vh - 30px)';
        windowEl.style.top = '0';
        windowEl.style.left = '0';
    }
}

function bringToFront(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    zIndex++;
    el.style.zIndex = zIndex;
    
    // Focus styling
    if (el.classList.contains('window')) {
        document.querySelectorAll('.window').forEach(w => {
            const tb = w.querySelector('.window-titlebar');
            if (tb) tb.classList.add('inactive');
        });
        const activeTb = el.querySelector('.window-titlebar');
        if (activeTb) activeTb.classList.remove('inactive');
        
        document.querySelectorAll('.taskbar-item').forEach(t => t.classList.remove('active'));
        const taskbarItem = document.getElementById('taskbar-' + elementId);
        if (taskbarItem) {
            taskbarItem.classList.add('active');
        }
    }
}

function addToTaskbar(windowId) {
    const taskbarItems = document.getElementById('taskbarItems');
    if (!taskbarItems) return;
    
    if (!document.getElementById('taskbar-' + windowId)) {
        const item = document.createElement('div');
        item.className = 'taskbar-item';
        item.id = 'taskbar-' + windowId;
        item.onclick = () => {
            const win = document.getElementById(windowId);
            if (win.classList.contains('active') && win.style.zIndex == zIndex) {
                minimizeWindow(windowId);
            } else {
                openWindow(windowId);
            }
        };
        
        let iconSrc = 'assets/icons/profile.svg';
        let title = 'Document';
        
        if (windowId === 'profileWindow') { iconSrc = 'assets/icons/profile.svg'; title = 'Profile.doc'; }
        else if (windowId === 'experienceWindow') { iconSrc = 'assets/icons/experience.svg'; title = 'Experience.exe'; }
        else if (windowId === 'skillsWindow') { iconSrc = 'assets/icons/skills.svg'; title = 'Skills.cpl'; }
        else if (windowId === 'contactWindow') { iconSrc = 'assets/icons/contact.svg'; title = 'Contact.lnk'; }
        
        item.innerHTML = `<img src="${iconSrc}" alt=""> <span>${title}</span>`;
        taskbarItems.appendChild(item);
    }
}

function removeFromTaskbar(windowId) {
    const item = document.getElementById('taskbar-' + windowId);
    if (item) {
        item.remove();
    }
}

// Dialog Operations
function showDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    if (!dialog) return;
    
    dialog.classList.add('active');
    bringToFront(dialogId);
    
    // Center dialog in viewport
    const rect = dialog.getBoundingClientRect();
    if (!dialog.style.left || dialog.style.left === '450px') {
        dialog.style.left = `${(window.innerWidth - rect.width) / 2}px`;
        dialog.style.top = `${(window.innerHeight - rect.height) / 2}px`;
    }
}

function closeDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    if (dialog) {
        dialog.classList.remove('active');
    }
}

// Start menu trigger
function toggleStartMenu() {
    const startMenu = document.getElementById('startMenu');
    const startBtn = document.getElementById('startBtn');
    if (startMenu && startBtn) {
        startMenu.classList.toggle('active');
        startBtn.classList.toggle('active');
    }
}

// Desktop icon selection styling
function selectIcon(element) {
    document.querySelectorAll('.desktop-icon').forEach(icon => {
        icon.classList.remove('selected');
    });
    element.classList.add('selected');
}

// Drag operations
function drag(e) {
    if (draggedElement) {
        draggedElement.style.left = (e.clientX - dragOffsetX) + 'px';
        draggedElement.style.top = (e.clientY - dragOffsetY) + 'px';
    }
}

function stopDrag() {
    draggedElement = null;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
}

// Export functions to global scope to handle inline events in HTML if any remain
window.openWindow = openWindow;
window.closeWindow = closeWindow;
window.minimizeWindow = minimizeWindow;
window.maximizeWindow = maximizeWindow;
window.showDialog = showDialog;
window.closeDialog = closeDialog;
window.bringToFront = bringToFront;
window.toggleStartMenu = toggleStartMenu;
window.selectIcon = selectIcon;

// Screensaver functions
function resetIdleTimer() {
    if (screensaverActive) {
        stopScreensaver();
    }
    idleTime = 0;
}

function startScreensaver() {
    screensaverActive = true;
    
    // Create screensaver overlay
    const overlay = document.createElement('div');
    overlay.id = 'screensaver-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = '#000000';
    overlay.style.zIndex = '99999';
    overlay.style.cursor = 'none'; // Hide cursor
    
    screensaverCanvas = document.createElement('canvas');
    screensaverCanvas.width = window.innerWidth;
    screensaverCanvas.height = window.innerHeight;
    overlay.appendChild(screensaverCanvas);
    document.body.appendChild(overlay);
    
    screensaverCtx = screensaverCanvas.getContext('2d');
    
    // Listen for window resize
    window.addEventListener('resize', resizeScreensaverCanvas);
    
    initScreensaverItems();
    loopScreensaver();
}

function resizeScreensaverCanvas() {
    if (screensaverActive && screensaverCanvas) {
        screensaverCanvas.width = window.innerWidth;
        screensaverCanvas.height = window.innerHeight;
    }
}

function initScreensaverItems() {
    screensaverItems = [];
    // Add stars (background depth)
    for (let i = 0; i < 80; i++) {
        screensaverItems.push({
            type: 'star',
            x: (Math.random() - 0.5) * window.innerWidth * 1.5,
            y: (Math.random() - 0.5) * window.innerHeight * 1.5,
            z: Math.random() * 1000,
            speed: 8 + Math.random() * 12
        });
    }
    // Add Windows 95 Flying Logos
    for (let i = 0; i < 12; i++) {
        screensaverItems.push({
            type: 'logo',
            x: (Math.random() - 0.5) * window.innerWidth * 0.4,
            y: (Math.random() - 0.5) * window.innerHeight * 0.4,
            z: Math.random() * 1000,
            speed: 4 + Math.random() * 6,
            size: 15 + Math.random() * 12
        });
    }
}

function loopScreensaver() {
    if (!screensaverActive || !screensaverCanvas || !screensaverCtx) return;
    
    screensaverCtx.fillStyle = '#000000';
    screensaverCtx.fillRect(0, 0, screensaverCanvas.width, screensaverCanvas.height);
    
    const cx = screensaverCanvas.width / 2;
    const cy = screensaverCanvas.height / 2;
    const fov = 350;
    
    screensaverItems.forEach(item => {
        item.z -= item.speed;
        if (item.z <= 0) {
            item.z = 1000;
            item.x = (Math.random() - 0.5) * screensaverCanvas.width * (item.type === 'logo' ? 0.3 : 1.5);
            item.y = (Math.random() - 0.5) * screensaverCanvas.height * (item.type === 'logo' ? 0.3 : 1.5);
        }
        
        const px = cx + (item.x / item.z) * fov;
        const py = cy + (item.y / item.z) * fov;
        
        // Reset item if projected coordinate is way out of bounds
        if (px < -100 || px > screensaverCanvas.width + 100 || py < -100 || py > screensaverCanvas.height + 100) {
            item.z = 1000;
            item.x = (Math.random() - 0.5) * screensaverCanvas.width * (item.type === 'logo' ? 0.3 : 1.5);
            item.y = (Math.random() - 0.5) * screensaverCanvas.height * (item.type === 'logo' ? 0.3 : 1.5);
            return;
        }
        
        if (item.type === 'star') {
            const size = (1 - item.z / 1000) * 2.5;
            screensaverCtx.fillStyle = '#ffffff';
            screensaverCtx.beginPath();
            screensaverCtx.arc(px, py, size > 0 ? size : 0.1, 0, Math.PI * 2);
            screensaverCtx.fill();
        } else {
            const size = (fov / item.z) * item.size;
            if (size > 2) {
                drawScreensaverWindowsLogo(screensaverCtx, px, py, size);
            }
        }
    });
    
    screensaverAnimFrame = requestAnimationFrame(loopScreensaver);
}

function drawScreensaverWindowsLogo(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = Math.max(1, size / 15);
    ctx.strokeStyle = '#000000';
    
    const qSize = size / 2;
    
    // Top Left: Red
    ctx.fillStyle = '#ff5555';
    ctx.beginPath();
    ctx.moveTo(-qSize, -qSize);
    ctx.quadraticCurveTo(-qSize/2, -qSize - (qSize*0.1), 0, -qSize);
    ctx.lineTo(0, 0);
    ctx.quadraticCurveTo(-qSize/2, -(qSize*0.1), -qSize, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Top Right: Green
    ctx.fillStyle = '#55ff55';
    ctx.beginPath();
    ctx.moveTo(0, -qSize);
    ctx.quadraticCurveTo(qSize/2, -qSize + (qSize*0.1), qSize, -qSize + (qSize*0.05));
    ctx.lineTo(qSize, 1);
    ctx.quadraticCurveTo(qSize/2, (qSize*0.1), 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Bottom Left: Blue
    ctx.fillStyle = '#5555ff';
    ctx.beginPath();
    ctx.moveTo(-qSize, 0);
    ctx.quadraticCurveTo(-qSize/2, -(qSize*0.1), 0, 0);
    ctx.lineTo(0, qSize);
    ctx.quadraticCurveTo(-qSize/2, qSize - (qSize*0.1), -qSize, qSize);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Bottom Right: Yellow
    ctx.fillStyle = '#ffff55';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(qSize/2, (qSize*0.1), qSize, 1);
    ctx.lineTo(qSize, qSize + (qSize*0.05));
    ctx.quadraticCurveTo(qSize/2, qSize + (qSize*0.1), 0, qSize);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
}

function stopScreensaver() {
    screensaverActive = false;
    if (screensaverAnimFrame) {
        cancelAnimationFrame(screensaverAnimFrame);
        screensaverAnimFrame = null;
    }
    window.removeEventListener('resize', resizeScreensaverCanvas);
    const overlay = document.getElementById('screensaver-overlay');
    if (overlay) {
        overlay.remove();
    }
}
