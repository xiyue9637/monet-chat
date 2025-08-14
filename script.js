// --- 配置 ---
const API_BASE_URL = 'https://monet-chat-api.bin856672.workers.dev/'; // 部署 Worker 后替换

// --- DOM 元素 ---
const authSection = document.getElementById('auth-section');
const chatSection = document.getElementById('chat-section');
const adminPanel = document.getElementById('admin-panel');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const sendBtn = document.getElementById('send-btn');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const userList = document.getElementById('user-list');
const clearTimeSelect = document.getElementById('clear-time-select');
const applyClearTimeBtn = document.getElementById('apply-clear-time-btn');
const clearAllMessagesBtn = document.getElementById('clear-all-messages-btn');

// --- 状态变量 ---
let currentUser = null;
let messagePollingInterval = null;

// --- 工具函数 ---
function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    section.classList.remove('hidden');
}

function switchForm(formToShow) {
    document.querySelectorAll('.form').forEach(form => form.classList.remove('active'));
    formToShow.classList.add('active');
}

function showError(elementId, message) {
    document.getElementById(elementId).textContent = message;
}

function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// --- API 调用函数 ---
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        ...options
    };
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        return data;
    } catch (error) {
        console.error(`API call to ${endpoint} failed:`, error);
        throw error;
    }
}

// --- 认证逻辑 ---
loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    switchForm(loginForm);
    clearErrors();
});

registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    switchForm(registerForm);
    clearErrors();
});

loginBtn.addEventListener('click', async () => {
    clearErrors();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        showError('login-error', '请输入用户名和密码');
        return;
    }

    try {
        const data = await apiCall('/login', {
            body: JSON.stringify({ username, password })
        });
        currentUser = data.user;
        localStorage.setItem('chatUser', JSON.stringify(currentUser));
        showChatInterface();
    } catch (error) {
        showError('login-error', error.message);
    }
});

registerBtn.addEventListener('click', async () => {
    clearErrors();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const nickname = document.getElementById('register-nickname').value.trim();
    const avatar = document.getElementById('register-avatar').value.trim();

    if (!username || !password || !nickname || !avatar) {
        showError('register-error', '请填写所有字段');
        return;
    }

    try {
        await apiCall('/register', {
            body: JSON.stringify({ username, password, nickname, avatar })
        });
        alert('注册成功！请登录。');
        // 自动切换到登录
        loginTab.click();
        document.getElementById('login-username').value = username;
        document.getElementById('login-password').value = password;
    } catch (error) {
        showError('register-error', error.message);
    }
});

logoutBtn.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('chatUser');
    clearInterval(messagePollingInterval);
    showSection(authSection);
    // 清空表单
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
});

// --- 聊天逻辑 ---
function showChatInterface() {
    document.getElementById('user-nickname').textContent = escapeHtml(currentUser.nickname);
    showSection(chatSection);
    loadMessages();
    messagePollingInterval = setInterval(loadMessages, 3000); // 每3秒刷新一次

    // 管理员特殊处理
    if (currentUser.username === 'xiyue') {
        adminPanel.classList.remove('hidden');
        loadAdminPanel();
    } else {
        adminPanel.classList.add('hidden');
    }
}

async function loadMessages() {
    try {
        const data = await apiCall('/messages', { method: 'GET' });
        displayMessages(data);
    } catch (error) {
        console.error("加载消息失败:", error);
        // 可以选择在界面上提示用户
    }
}

function displayMessages(messages) {
    messagesContainer.innerHTML = '';
    messages.forEach(msg => {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${msg.username === currentUser.username ? 'own' : ''}`;
        messageElement.innerHTML = `
            <img class="avatar" src="${escapeHtml(msg.avatar)}" alt="Avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(msg.nickname)}&background=random';">
            <div>
                <div class="content">${escapeHtml(msg.message)}</div>
                <div class="info">${escapeHtml(msg.nickname)} - ${new Date(msg.timestamp).toLocaleString()}</div>
            </div>
        `;
        messagesContainer.appendChild(messageElement);
    });
    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    try {
        await apiCall('/send', {
            body: JSON.stringify({ username: currentUser.username, message })
        });
        messageInput.value = '';
        // 立即刷新消息
        await loadMessages();
    } catch (error) {
        alert("发送消息失败: " + error.message);
    }
}

// --- 管理员逻辑 ---
async function loadAdminPanel() {
    try {
        const clearTimeData = await apiCall('/get-clear-time', { method: 'GET' });
        clearTimeSelect.value = clearTimeData.time || '0';

        const usersData = await apiCall('/user-list', { method: 'GET' });
        displayUserList(usersData);
    } catch (error) {
        console.error("加载管理员面板失败:", error);
    }
}

function displayUserList(users) {
    userList.innerHTML = '';
    users.forEach(user => {
        if (user.username === 'xiyue') return; // 不显示管理员自己
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${escapeHtml(user.nickname)} (@${escapeHtml(user.username)})</span>
            <div class="user-actions">
                <button onclick="muteUser('${user.username}')">禁言</button>
                <button onclick="removeUser('${user.username}')">移除</button>
            </div>
        `;
        userList.appendChild(li);
    });
}

applyClearTimeBtn.addEventListener('click', async () => {
    const time = clearTimeSelect.value;
    try {
        await apiCall('/set-clear-time', {
            body: JSON.stringify({ time: parseInt(time) })
        });
        alert('自动清除时间设置成功');
    } catch (error) {
        alert('设置失败: ' + error.message);
    }
});

clearAllMessagesBtn.addEventListener('click', async () => {
    if (!confirm('确定要清除所有聊天记录吗？')) return;
    try {
        await apiCall('/clear-messages', { method: 'POST' });
        loadMessages(); // 刷新消息列表
        alert('所有消息已清除');
    } catch (error) {
        alert('清除失败: ' + error.message);
    }
});

// 暴露给全局作用域，供HTML内联onclick使用
window.muteUser = async function(username) {
    try {
        await apiCall('/mute', {
            body: JSON.stringify({ username })
        });
        alert(`用户 @${username} 已被禁言`);
        loadAdminPanel(); // 刷新用户列表
    } catch (error) {
        alert('禁言失败: ' + error.message);
    }
};

window.removeUser = async function(username) {
    if (!confirm(`确定要移除用户 @${username} 吗？此操作不可逆。`)) return;
    try {
        await apiCall('/remove', {
            body: JSON.stringify({ username })
        });
        alert(`用户 @${username} 已被移除`);
        loadAdminPanel(); // 刷新用户列表
    } catch (error) {
        alert('移除失败: ' + error.message);
    }
};

// --- 页面加载初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    // 尝试从本地存储恢复登录状态
    const storedUser = localStorage.getItem('chatUser');
    if (storedUser) {
        try {
            currentUser = JSON.parse(storedUser);
            showChatInterface();
        } catch (e) {
            console.error("解析存储的用户信息失败", e);
            localStorage.removeItem('chatUser');
        }
    } else {
        showSection(authSection);
    }
});