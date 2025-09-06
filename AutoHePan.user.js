// ==UserScript==
// @name         自动化大红楼
// @namespace    http://tampermonkey.net/
// @version      2.5.5
// @description  自动在校园论坛中发帖，智能检测限制，优化用户体验，支持深色模式
// @author       JackZhang144
// @match        *://webvpn.uestc.edu.cn/https/77726476706e69737468656265737421f2f552d232357b447d468ca88d1b203b/thread/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @downloadURL https://github.com/Jackzhang144/tempermonkey_js/raw/main/AutoHePan.user.js
// @updateURL https://github.com/Jackzhang144/tempermonkey_js/raw/main/AutoHePan.user.js
// ==/UserScript==


// 目前默认匹配通过WEBVPN登录河畔后的任意贴地址，后期河畔开放外网之后会修改成匹配原版地址

(function() {
    'use strict';

    // 默认配置
    const DEFAULT_CONFIG = {
        minDelay: 3000,
        maxDelay: 8000,
        contents: ["水水", "水水水", "水水水水", "水水水水水", "水水水水水水", "水水水水水水水"],
        enabled: false,
        panelMinimized: false,
        panelPosition: { x: 20, y: 20 }, // 默认位置
        maxConsecutiveErrors: 5 // 默认最大连续错误次数
    };

    let config = {...DEFAULT_CONFIG};
    let isAutoPosting = false;
    let isWaitingDueToLimit = false;
    let postingTimeout = null;
    let waitingTimeout = null;
    let attemptCount = 0;
    let errorCount = 0;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    // 初始化配置
    function initConfig() {
        try {
            const savedConfig = GM_getValue('autoPostConfig');
            if (savedConfig) {
                config = {...DEFAULT_CONFIG, ...savedConfig};
            }
        } catch (e) {
            console.error('配置初始化失败:', e);
        }
    }

    // 保存配置
    function saveConfig() {
        try {
            GM_setValue('autoPostConfig', config);
        } catch (e) {
            console.error('保存配置失败:', e);
        }
    }

    // 创建UI控件
    function createControlPanel() {
        try {
            // 如果面板已存在，先移除
            const existingPanel = document.getElementById('autoPostPanel');
            if (existingPanel) {
                existingPanel.remove();
            }

            // 创建容器
            const panel = document.createElement('div');
            panel.id = 'autoPostPanel';
            panel.style.position = 'fixed';
            panel.style.top = config.panelPosition.y + 'px';
            panel.style.left = config.panelPosition.x + 'px';
            panel.style.zIndex = '999999';
            panel.style.padding = config.panelMinimized ? '6px' : '12px';
            panel.style.backgroundColor = '#ffffff';
            panel.style.borderRadius = '8px';
            panel.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.15)';
            panel.style.fontFamily = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
            panel.style.width = config.panelMinimized ? 'auto' : '300px';
            panel.style.maxHeight = '85vh';
            panel.style.overflowY = 'auto';
            panel.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
            panel.style.backdropFilter = 'blur(5px)';
            panel.style.border = '1px solid rgba(0, 0, 0, 0.1)';
            panel.style.cursor = 'move';

            // 标题栏
            const titleBar = document.createElement('div');
            titleBar.style.display = 'flex';
            titleBar.style.justifyContent = 'space-between';
            titleBar.style.alignItems = 'center';
            titleBar.style.marginBottom = config.panelMinimized ? '0' : '12px';
            titleBar.style.cursor = 'move';
            titleBar.style.userSelect = 'none';
            titleBar.style.padding = '4px 0';

            // 添加拖拽事件监听器
            titleBar.addEventListener('mousedown', startDrag);

            const title = document.createElement('h3');
            title.textContent = '自动水帖工具';
            title.style.margin = '0';
            title.style.fontSize = '16px';
            title.style.color = '#2c3e50';
            title.style.fontWeight = '600';
            title.style.flexGrow = '1';

            // 最小化按钮
            const minimizeBtn = document.createElement('button');
            minimizeBtn.textContent = config.panelMinimized ? '▢' : '−';
            minimizeBtn.style.background = 'none';
            minimizeBtn.style.border = 'none';
            minimizeBtn.style.fontSize = '16px';
            minimizeBtn.style.cursor = 'pointer';
            minimizeBtn.style.padding = '3px';
            minimizeBtn.style.marginLeft = '8px';
            minimizeBtn.style.color = '#7f8c8d';
            minimizeBtn.style.borderRadius = '3px';
            minimizeBtn.style.transition = 'background-color 0.2s';
            minimizeBtn.style.width = '24px';
            minimizeBtn.style.height = '24px';
            minimizeBtn.style.display = 'flex';
            minimizeBtn.style.alignItems = 'center';
            minimizeBtn.style.justifyContent = 'center';

            minimizeBtn.addEventListener('mouseover', function() {
                this.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            });

            minimizeBtn.addEventListener('mouseout', function() {
                this.style.backgroundColor = 'transparent';
            });

            titleBar.appendChild(title);
            titleBar.appendChild(minimizeBtn);
            panel.appendChild(titleBar);

            // 如果面板已最小化，只显示标题栏
            if (config.panelMinimized) {
                // 添加到文档
                document.body.appendChild(panel);

                // 点击标题栏展开面板
                titleBar.addEventListener('click', function() {
                    config.panelMinimized = false;
                    saveConfig();
                    createControlPanel();
                });

                return;
            }

            // 配置区域
            const configSection = document.createElement('div');
            configSection.style.marginBottom = '12px';
            configSection.style.padding = '10px';
            configSection.style.backgroundColor = 'rgba(236, 240, 241, 0.3)';
            configSection.style.borderRadius = '6px';

            // 配置区域标题
            const configTitle = document.createElement('h4');
            configTitle.textContent = '⚙️ 配置选项';
            configTitle.style.margin = '0 0 10px 0';
            configTitle.style.fontSize = '14px';
            configTitle.style.color = '#34495e';
            configTitle.style.fontWeight = '600';
            configTitle.style.display = 'flex';
            configTitle.style.alignItems = 'center';

            configSection.appendChild(configTitle);

            // 最小间隔时间
            const minDelayLabel = document.createElement('label');
            minDelayLabel.textContent = '⏱ 最小间隔(毫秒):';
            minDelayLabel.style.display = 'block';
            minDelayLabel.style.marginBottom = '5px';
            minDelayLabel.style.fontWeight = '500';
            minDelayLabel.style.fontSize = '12px';
            minDelayLabel.style.color = '#2c3e50';

            const minDelayInput = document.createElement('input');
            minDelayInput.type = 'number';
            minDelayInput.value = config.minDelay;
            minDelayInput.style.width = '100%';
            minDelayInput.style.padding = '6px';
            minDelayInput.style.border = '1px solid #ddd';
            minDelayInput.style.borderRadius = '4px';
            minDelayInput.style.marginBottom = '8px';
            minDelayInput.min = 1000;
            minDelayInput.style.boxSizing = 'border-box';
            minDelayInput.style.transition = 'border-color 0.3s';
            minDelayInput.style.fontSize = '12px';

            minDelayInput.addEventListener('focus', function() {
                this.style.borderColor = '#3498db';
                this.style.boxShadow = '0 0 0 2px rgba(52, 152, 219, 0.2)';
            });

            minDelayInput.addEventListener('blur', function() {
                this.style.borderColor = '#ddd';
                this.style.boxShadow = 'none';
            });

            // 最大间隔时间
            const maxDelayLabel = document.createElement('label');
            maxDelayLabel.textContent = '⏱ 最大间隔(毫秒):';
            maxDelayLabel.style.display = 'block';
            maxDelayLabel.style.marginBottom = '5px';
            maxDelayLabel.style.fontWeight = '500';
            maxDelayLabel.style.fontSize = '12px';
            maxDelayLabel.style.color = '#2c3e50';

            const maxDelayInput = document.createElement('input');
            maxDelayInput.type = 'number';
            maxDelayInput.value = config.maxDelay;
            maxDelayInput.style.width = '100%';
            maxDelayInput.style.padding = '6px';
            maxDelayInput.style.border = '1px solid #ddd';
            maxDelayInput.style.borderRadius = '4px';
            maxDelayInput.style.marginBottom = '8px';
            maxDelayInput.min = 2000;
            maxDelayInput.style.boxSizing = 'border-box';
            maxDelayInput.style.transition = 'border-color 0.3s';
            maxDelayInput.style.fontSize = '12px';

            maxDelayInput.addEventListener('focus', function() {
                this.style.borderColor = '#3498db';
                this.style.boxShadow = '0 0 0 2px rgba(52, 152, 219, 0.2)';
            });

            maxDelayInput.addEventListener('blur', function() {
                this.style.borderColor = '#ddd';
                this.style.boxShadow = 'none';
            });

            // 发帖内容
            const contentLabel = document.createElement('label');
            contentLabel.textContent = '💬 发帖内容(中文逗号分隔):';
            contentLabel.style.display = 'block';
            contentLabel.style.marginBottom = '5px';
            contentLabel.style.fontWeight = '500';
            contentLabel.style.fontSize = '12px';
            contentLabel.style.color = '#2c3e50';

            const contentTextarea = document.createElement('textarea');
            contentTextarea.value = config.contents.join('，');
            contentTextarea.style.width = '100%';
            contentTextarea.style.padding = '6px';
            contentTextarea.style.border = '1px solid #ddd';
            contentTextarea.style.borderRadius = '4px';
            contentTextarea.style.marginBottom = '8px';
            contentTextarea.style.height = '80px';
            contentTextarea.style.resize = 'vertical';
            contentTextarea.style.fontSize = '12px';
            contentTextarea.style.boxSizing = 'border-box';
            contentTextarea.style.transition = 'border-color 0.3s';

            contentTextarea.addEventListener('focus', function() {
                this.style.borderColor = '#3498db';
                this.style.boxShadow = '0 0 0 2px rgba(52, 152, 219, 0.2)';
            });

            contentTextarea.addEventListener('blur', function() {
                this.style.borderColor = '#ddd';
                this.style.boxShadow = 'none';
            });

            // 最大连续错误次数
            const maxErrorsLabel = document.createElement('label');
            maxErrorsLabel.textContent = '❌ 最大连续错误次数:';
            maxErrorsLabel.style.display = 'block';
            maxErrorsLabel.style.marginBottom = '5px';
            maxErrorsLabel.style.fontWeight = '500';
            maxErrorsLabel.style.fontSize = '12px';
            maxErrorsLabel.style.color = '#2c3e50';

            const maxErrorsInput = document.createElement('input');
            maxErrorsInput.type = 'number';
            maxErrorsInput.value = config.maxConsecutiveErrors;
            maxErrorsInput.style.width = '100%';
            maxErrorsInput.style.padding = '6px';
            maxErrorsInput.style.border = '1px solid #ddd';
            maxErrorsInput.style.borderRadius = '4px';
            maxErrorsInput.style.marginBottom = '8px';
            maxErrorsInput.min = 1;
            maxErrorsInput.max = 10;
            maxErrorsInput.style.boxSizing = 'border-box';
            maxErrorsInput.style.transition = 'border-color 0.3s';
            maxErrorsInput.style.fontSize = '12px';

            maxErrorsInput.addEventListener('focus', function() {
                this.style.borderColor = '#3498db';
                this.style.boxShadow = '0 0 0 2px rgba(52, 152, 219, 0.2)';
            });

            maxErrorsInput.addEventListener('blur', function() {
                this.style.borderColor = '#ddd';
                this.style.boxShadow = 'none';
            });

            // 保存配置按钮
            const saveConfigBtn = document.createElement('button');
            saveConfigBtn.textContent = '💾 保存配置';
            saveConfigBtn.style.padding = '8px';
            saveConfigBtn.style.backgroundColor = '#3498db';
            saveConfigBtn.style.color = 'white';
            saveConfigBtn.style.border = 'none';
            saveConfigBtn.style.borderRadius = '4px';
            saveConfigBtn.style.cursor = 'pointer';
            saveConfigBtn.style.fontSize = '13px';
            saveConfigBtn.style.marginBottom = '10px';
            saveConfigBtn.style.width = '100%';
            saveConfigBtn.style.fontWeight = '600';
            saveConfigBtn.style.transition = 'all 0.3s';
            saveConfigBtn.style.boxShadow = '0 2px 4px rgba(52, 152, 219, 0.3)';

            saveConfigBtn.addEventListener('mouseover', function() {
                this.style.backgroundColor = '#2980b9';
                this.style.transform = 'translateY(-1px)';
                this.style.boxShadow = '0 4px 8px rgba(52, 152, 219, 0.4)';
            });

            saveConfigBtn.addEventListener('mouseout', function() {
                this.style.backgroundColor = '#3498db';
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '0 2px 4px rgba(52, 152, 219, 0.3)';
            });

            saveConfigBtn.addEventListener('mousedown', function() {
                this.style.transform = 'translateY(0)';
            });

            saveConfigBtn.addEventListener('mouseup', function() {
                this.style.transform = 'translateY(-1px)';
            });

            // 添加到配置区域
            configSection.appendChild(minDelayLabel);
            configSection.appendChild(minDelayInput);
            configSection.appendChild(maxDelayLabel);
            configSection.appendChild(maxDelayInput);
            configSection.appendChild(contentLabel);
            configSection.appendChild(contentTextarea);
            configSection.appendChild(maxErrorsLabel);
            configSection.appendChild(maxErrorsInput);
            configSection.appendChild(saveConfigBtn);

            // 控制区域
            const controlSection = document.createElement('div');
            controlSection.style.padding = '10px';
            controlSection.style.backgroundColor = 'rgba(236, 240, 241, 0.3)';
            controlSection.style.borderRadius = '6px';

            // 控制区域标题
            const controlTitle = document.createElement('h4');
            controlTitle.textContent = '🎮 控制面板';
            controlTitle.style.margin = '0 0 10px 0';
            controlTitle.style.fontSize = '14px';
            controlTitle.style.color = '#34495e';
            controlTitle.style.fontWeight = '600';
            controlTitle.style.display = 'flex';
            controlTitle.style.alignItems = 'center';

            // 开关按钮
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'autoPostToggle';
            toggleBtn.textContent = isAutoPosting ? '⏹ 停止自动发帖' : '▶ 开始自动发帖';
            toggleBtn.style.padding = '10px';
            toggleBtn.style.backgroundColor = isAutoPosting ? '#e74c3c' : '#2ecc71';
            toggleBtn.style.color = 'white';
            toggleBtn.style.border = 'none';
            toggleBtn.style.borderRadius = '4px';
            toggleBtn.style.cursor = 'pointer';
            toggleBtn.style.fontSize = '13px';
            toggleBtn.style.marginBottom = '10px';
            toggleBtn.style.width = '100%';
            toggleBtn.style.fontWeight = '600';
            toggleBtn.style.transition = 'all 0.3s';
            toggleBtn.style.boxShadow = isAutoPosting ? '0 2px 4px rgba(231, 76, 60, 0.3)' : '0 2px 4px rgba(46, 204, 113, 0.3)';

            toggleBtn.addEventListener('mouseover', function() {
                if (isAutoPosting) {
                    this.style.backgroundColor = '#c0392b';
                    this.style.transform = 'translateY(-1px)';
                    this.style.boxShadow = '0 4px 8px rgba(231, 76, 60, 0.4)';
                } else {
                    this.style.backgroundColor = '#27ae60';
                    this.style.transform = 'translateY(-1px)';
                    this.style.boxShadow = '0 4px 8px rgba(46, 204, 113, 0.4)';
                }
            });

            toggleBtn.addEventListener('mouseout', function() {
                if (isAutoPosting) {
                    this.style.backgroundColor = '#e74c3c';
                    this.style.transform = 'translateY(0)';
                    this.style.boxShadow = '0 2px 4px rgba(231, 76, 60, 0.3)';
                } else {
                    this.style.backgroundColor = '#2ecc71';
                    this.style.transform = 'translateY(0)';
                    this.style.boxShadow = '0 2px 4px rgba(46, 204, 113, 0.3)';
                }
            });

            toggleBtn.addEventListener('mousedown', function() {
                this.style.transform = 'translateY(0)';
            });

            toggleBtn.addEventListener('mouseup', function() {
                this.style.transform = 'translateY(-1px)';
            });

            // 状态显示
            const statusContainer = document.createElement('div');
            statusContainer.style.display = 'flex';
            statusContainer.style.flexDirection = 'column';
            statusContainer.style.gap = '6px';
            statusContainer.style.marginBottom = '6px';

            const status = document.createElement('div');
            status.id = 'autoPostStatus';
            status.style.display = 'flex';
            status.style.alignItems = 'center';
            status.style.padding = '6px';
            status.style.borderRadius = '4px';
            status.style.fontWeight = '500';
            status.style.fontSize = '12px';

            if (isWaitingDueToLimit) {
                status.innerHTML = '⏳ 状态: 等待限制解除';
                status.style.backgroundColor = 'rgba(230, 126, 34, 0.2)';
                status.style.color = '#e67e22';
            } else {
                status.innerHTML = `🔵 状态: ${isAutoPosting ? '运行中' : '已停止'}`;
                status.style.backgroundColor = isAutoPosting ? 'rgba(46, 204, 113, 0.2)' : 'rgba(127, 140, 141, 0.2)';
                status.style.color = isAutoPosting ? '#27ae60' : '#7f8c8d';
            }

            // 计数器显示
            const countersContainer = document.createElement('div');
            countersContainer.style.display = 'flex';
            countersContainer.style.gap = '6px';

            const counter = document.createElement('div');
            counter.id = 'autoPostCounter';
            counter.textContent = `📝 已发帖: ${attemptCount} 次`;
            counter.style.flex = '1';
            counter.style.padding = '6px';
            counter.style.borderRadius = '4px';
            counter.style.fontSize = '11px';
            counter.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
            counter.style.color = '#3498db';
            counter.style.fontWeight = '500';

            // 错误计数器显示
            const errorCounter = document.createElement('div');
            errorCounter.id = 'autoPostErrorCounter';
            errorCounter.textContent = `❌ 错误: ${errorCount} 次`;
            errorCounter.style.flex = '1';
            errorCounter.style.padding = '6px';
            errorCounter.style.borderRadius = '4px';
            errorCounter.style.fontSize = '11px';
            errorCounter.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
            errorCounter.style.color = '#e74c3c';
            errorCounter.style.fontWeight = '500';

            countersContainer.appendChild(counter);
            countersContainer.appendChild(errorCounter);

            statusContainer.appendChild(status);
            statusContainer.appendChild(countersContainer);

            // 添加到控制区域
            controlSection.appendChild(controlTitle);
            controlSection.appendChild(toggleBtn);
            controlSection.appendChild(statusContainer);

            // 添加到面板
            panel.appendChild(configSection);
            panel.appendChild(controlSection);

            // 添加到文档
            document.body.appendChild(panel);

            // 保存配置事件
            saveConfigBtn.addEventListener('click', function() {
                const min = parseInt(minDelayInput.value);
                const max = parseInt(maxDelayInput.value);
                const contents = contentTextarea.value.split('，').filter(c => c.trim() !== '');
                const maxErrors = parseInt(maxErrorsInput.value);

                if (isNaN(min) || isNaN(max) || min < 1000 || max < 2000 || min >= max) {
                    showNotification('请输入有效的时间间隔（最小≥1000，最大≥2000，且最大>最小）', 'error');
                    return;
                }

                if (contents.length === 0) {
                    showNotification('请输入至少一条发帖内容', 'error');
                    return;
                }

                if (isNaN(maxErrors) || maxErrors < 1 || maxErrors > 10) {
                    showNotification('请输入有效的最大连续错误次数（1-10之间）', 'error');
                    return;
                }

                config.minDelay = min;
                config.maxDelay = max;
                config.contents = contents;
                config.maxConsecutiveErrors = maxErrors;

                saveConfig();
                showNotification('✅ 配置已保存！', 'success');
            });

            // 切换按钮事件
            toggleBtn.addEventListener('click', function() {
                if (isWaitingDueToLimit) {
                    // 如果正在等待限制解除，点击按钮将取消等待并完全停止
                    clearTimeout(waitingTimeout);
                    isWaitingDueToLimit = false;
                    isAutoPosting = false;
                    config.enabled = false;
                    saveConfig();
                    updateUI();
                    showNotification('⏹ 已取消等待并停止自动发帖', 'info');
                } else {
                    // 正常切换状态
                    isAutoPosting = !isAutoPosting;
                    config.enabled = isAutoPosting;
                    saveConfig();

                    if (isAutoPosting) {
                        startAutoPosting();
                    } else {
                        stopAutoPosting();
                    }

                    updateUI();
                }
            });

            // 最小化按钮事件
            minimizeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                config.panelMinimized = true;
                saveConfig();
                createControlPanel();
            });

            // 如果配置为启用，自动开始
            if (config.enabled && !isAutoPosting) {
                isAutoPosting = true;
                startAutoPosting();
            }
        } catch (e) {
            console.error('创建控制面板失败:', e);
            // 如果UI创建失败，显示一个简单的按钮来重新加载
            showReloadButton();
        }
    }

    // 拖拽开始
    function startDrag(e) {
        // 只有在左键点击时才开始拖拽
        if (e.button !== 0) return;

        isDragging = true;
        const panel = document.getElementById('autoPostPanel');

        // 计算鼠标点击位置与面板左上角的偏移
        const rect = panel.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;

        // 添加全局事件监听器
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);

        // 防止文本选择
        e.preventDefault();
    }

    // 拖拽过程
    function drag(e) {
        if (!isDragging) return;

        const panel = document.getElementById('autoPostPanel');

        // 计算新的位置
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;

        // 更新面板位置
        panel.style.left = x + 'px';
        panel.style.top = y + 'px';

        // 保存位置到配置
        config.panelPosition = { x, y };
    }

    // 停止拖拽
    function stopDrag() {
        isDragging = false;

        // 移除全局事件监听器
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);

        // 保存位置配置
        saveConfig();
    }

    // 显示重新加载按钮
    function showReloadButton() {
        const reloadBtn = document.createElement('button');
        reloadBtn.textContent = '🔄 加载自动水帖工具';
        reloadBtn.style.position = 'fixed';
        reloadBtn.style.top = '20px';
        reloadBtn.style.right = '20px';
        reloadBtn.style.zIndex = '999999';
        reloadBtn.style.padding = '10px 15px';
        reloadBtn.style.backgroundColor = '#3498db';
        reloadBtn.style.color = 'white';
        reloadBtn.style.border = 'none';
        reloadBtn.style.borderRadius = '6px';
        reloadBtn.style.cursor = 'pointer';
        reloadBtn.style.fontSize = '13px';
        reloadBtn.style.fontWeight = '600';
        reloadBtn.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.15)';
        reloadBtn.style.transition = 'all 0.3s';

        reloadBtn.addEventListener('mouseover', function() {
            this.style.backgroundColor = '#2980b9';
            this.style.transform = 'translateY(-1px)';
            this.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.2)';
        });

        reloadBtn.addEventListener('mouseout', function() {
            this.style.backgroundColor = '#3498db';
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.15)';
        });

        document.body.appendChild(reloadBtn);
    }

    // 显示通知（非阻塞式）
    function showNotification(message, type = 'info') {
        // 移除现有通知
        const existingNotification = document.getElementById('autoPostNotification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // 创建通知元素
        const notification = document.createElement('div');
        notification.id = 'autoPostNotification';
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '12px 16px';
        notification.style.borderRadius = '6px';
        notification.style.zIndex = '1000000';
        notification.style.fontFamily = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        notification.style.fontSize = '13px';
        notification.style.fontWeight = '500';
        notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        notification.style.maxWidth = '300px';
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        notification.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
        notification.style.display = 'flex';
        notification.style.alignItems = 'center';

        // 根据类型设置样式
        if (type === 'error') {
            notification.style.backgroundColor = '#ffebee';
            notification.style.color = '#c62828';
            notification.style.borderLeft = '4px solid #f44336';
        } else if (type === 'success') {
            notification.style.backgroundColor = '#e8f5e9';
            notification.style.color = '#2e7d32';
            notification.style.borderLeft = '4px solid #4caf50';
        } else {
            notification.style.backgroundColor = '#e3f2fd';
            notification.style.color = '#1565c0';
            notification.style.borderLeft = '4px solid #2196f3';
        }

        // 添加到文档
        document.body.appendChild(notification);

        // 显示动画
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 10);

        // 5秒后自动消失
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    // 更新UI状态
    function updateUI() {
        const status = document.getElementById('autoPostStatus');
        const toggleBtn = document.getElementById('autoPostToggle');
        const counter = document.getElementById('autoPostCounter');
        const errorCounter = document.getElementById('autoPostErrorCounter');

        if (status) {
            if (isWaitingDueToLimit) {
                status.innerHTML = '⏳ 状态: 等待限制解除';
                status.style.backgroundColor = 'rgba(230, 126, 34, 0.2)';
                status.style.color = '#e67e22';
            } else {
                status.innerHTML = `🔵 状态: ${isAutoPosting ? '运行中' : '已停止'}`;
                status.style.backgroundColor = isAutoPosting ? 'rgba(46, 204, 113, 0.2)' : 'rgba(127, 140, 141, 0.2)';
                status.style.color = isAutoPosting ? '#27ae60' : '#7f8c8d';
            }
        }

        if (toggleBtn) {
            if (isWaitingDueToLimit) {
                toggleBtn.textContent = '⏹ 取消等待并停止';
                toggleBtn.style.backgroundColor = '#e74c3c';
                toggleBtn.style.boxShadow = '0 2px 4px rgba(231, 76, 60, 0.3)';
            } else {
                toggleBtn.textContent = isAutoPosting ? '⏹ 停止自动发帖' : '▶ 开始自动发帖';
                toggleBtn.style.backgroundColor = isAutoPosting ? '#e74c3c' : '#2ecc71';
                toggleBtn.style.boxShadow = isAutoPosting ? '0 2px 4px rgba(231, 76, 60, 0.3)' : '0 2px 4px rgba(46, 204, 113, 0.3)';
            }
        }

        if (counter) {
            counter.textContent = `📝 已发帖: ${attemptCount} 次`;
        }

        if (errorCounter) {
            errorCounter.textContent = `❌ 错误: ${errorCount} 次`;
        }
    }

    // 检测错误弹窗
    function checkErrorPopup() {
        // 查找包含错误信息的元素
        const errorElements = document.querySelectorAll('.MuiAlert-message');
        for (const element of errorElements) {
            if (element.textContent.includes('本帖最多允许连续回复 9 次')) {
                return true;
            }
        }
        return false;
    }

    // 获取随机内容
    function getRandomContent() {
        if (config.contents.length === 0) return "水水";
        const index = Math.floor(Math.random() * config.contents.length);
        return config.contents[index];
    }

    // 获取随机间隔时间
    function getRandomDelay() {
        return Math.floor(Math.random() * (config.maxDelay - config.minDelay + 1)) + config.minDelay;
    }

    // 查找文本输入框 - 支持深色和浅色模式
    function findTextInput() {
        // 尝试查找即时渲染模式下的输入框 (vditor-ir)
        let textInput = document.querySelector('.vditor-ir .vditor-reset[contenteditable="true"]');

        // 如果没找到，尝试查找所见即所得模式下的输入框 (vditor-wysiwyg)
        if (!textInput) {
            textInput = document.querySelector('.vditor-wysiwyg .vditor-reset[contenteditable="true"]');
        }

        // 如果没找到，尝试查找分屏预览模式下的输入框 (vditor-sv)
        if (!textInput) {
            textInput = document.querySelector('.vditor-sv.vditor-reset[contenteditable="true"]');
        }

        return textInput;
    }

    // 查找回复按钮 - 支持深色和浅色模式
    function findReplyButton() {
        // 使用更通用的选择器查找回复按钮
        return document.querySelector('button.MuiButton-containedPrimary');
    }

    // 输入文本
    function inputText(content) {
        const textInput = findTextInput();
        if (textInput) {
            // 清空现有内容
            textInput.innerHTML = '';

            // 创建新的段落元素
            const p = document.createElement('p');
            p.setAttribute('data-block', '0');
            p.textContent = content;

            // 添加到输入框
            textInput.appendChild(p);

            // 触发输入事件
            const event = new Event('input', { bubbles: true });
            textInput.dispatchEvent(event);

            // 触发键盘事件
            const keydownEvent = new KeyboardEvent('keydown', { bubbles: true });
            const keyupEvent = new KeyboardEvent('keyup', { bubbles: true });
            textInput.dispatchEvent(keydownEvent);
            textInput.dispatchEvent(keyupEvent);

            return true;
        }
        return false;
    }

    // 点击回复按钮
    function clickReplyButton() {
        const replyButton = findReplyButton();
        if (replyButton && !replyButton.disabled) {
            replyButton.click();
            return true;
        }
        return false;
    }

    // 滚动到页面底部
    function scrollToBottom() {
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
        });
    }

    // 检测回复是否成功
    function checkPostSuccess() {
        const textInput = findTextInput();
        return textInput && textInput.textContent === '';
    }

    // 处理发帖限制
    function handlePostLimit() {
        errorCount++;
        updateUI();

        console.log('检测到发帖限制，等待一段时间后重试');
        showNotification('⚠️ 检测到发帖限制：本帖最多允许连续回复 9 次，休息一会儿再来吧', 'error');

        // 检查是否连续错误达到配置的次数
        if (errorCount >= config.maxConsecutiveErrors) {
            stopAutoPosting();
            showNotification(`❌ 连续发帖失败${config.maxConsecutiveErrors}次，自动停止发帖机`, 'error');
            return;
        }

        // 设置等待状态
        isWaitingDueToLimit = true;
        isAutoPosting = false;
        updateUI();

        // 等待配置的最大间隔时间的2倍
        const waitTime = config.maxDelay * 2;
        console.log(`等待 ${waitTime} 毫秒后重试`);

        // 设置等待超时
        waitingTimeout = setTimeout(() => {
            console.log('等待结束，重新开始自动发帖');
            isWaitingDueToLimit = false;

            // 只有当用户没有手动停止时才重新开始
            if (config.enabled) {
                isAutoPosting = true;
                startAutoPosting();
            }

            updateUI();
        }, waitTime);
    }

    // 执行一次发帖流程
    async function postOnce() {
        if (attemptCount >= 1000) {
            stopAutoPosting();
            showNotification('ℹ️ 已达到最大尝试次数，自动发帖已停止', 'info');
            return false;
        }

        attemptCount++;
        updateUI();

        // 获取随机内容
        const content = getRandomContent();
        console.log(`开始第 ${attemptCount} 次发帖，内容: "${content}"`);

        // 输入文本
        if (!inputText(content)) {
            console.log('未找到文本输入框');
            errorCount++;
            updateUI();

            // 检查是否连续错误达到配置的次数
            if (errorCount >= config.maxConsecutiveErrors) {
                stopAutoPosting();
                showNotification(`❌ 连续发帖失败${config.maxConsecutiveErrors}次，自动停止发帖机`, 'error');
            }
            return false;
        }

        console.log('文本输入完成');

        // 等待一下让文本输入完成
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 点击回复
        if (!clickReplyButton()) {
            console.log('未找到回复按钮或按钮不可用');
            errorCount++;
            updateUI();

            // 检查是否连续错误达到配置的次数
            if (errorCount >= config.maxConsecutiveErrors) {
                stopAutoPosting();
                showNotification(`❌ 连续发帖失败${config.maxConsecutiveErrors}次，自动停止发帖机`, 'error');
            }
            return false;
        }

        console.log('已点击回复按钮');

        // 等待一段时间检查是否有错误弹窗
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 检查是否有错误弹窗
        if (checkErrorPopup()) {
            handlePostLimit();
            return false;
        }

        // 等待回复完成
        const delay = getRandomDelay();
        console.log(`等待 ${delay} 毫秒后进行下一次发帖`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // 检查是否成功
        if (checkPostSuccess()) {
            console.log('回复成功');
            // 滚动到页面底部
            scrollToBottom();
            console.log('已滚动到页面底部');
            // 发帖成功，清空错误计数
            errorCount = 0;
            updateUI();
            return true;
        } else {
            console.log('回复可能失败');
            errorCount++;
            updateUI();

            // 检查是否连续错误达到配置的次数
            if (errorCount >= config.maxConsecutiveErrors) {
                stopAutoPosting();
                showNotification(`❌ 连续发帖失败${config.maxConsecutiveErrors}次，自动停止发帖机`, 'error');
            }
            return false;
        }
    }

    // 开始自动发帖
    function startAutoPosting() {
        if (postingTimeout) {
            clearTimeout(postingTimeout);
        }

        if (!isAutoPosting) return;

        const postNext = async () => {
            if (!isAutoPosting) return;

            await postOnce();

            if (isAutoPosting && !isWaitingDueToLimit) {
                const nextDelay = getRandomDelay();
                postingTimeout = setTimeout(postNext, nextDelay);
            }
        };

        // 立即开始第一次发帖
        postNext();
    }

    // 停止自动发帖
    function stopAutoPosting() {
        if (postingTimeout) {
            clearTimeout(postingTimeout);
            postingTimeout = null;
        }

        if (waitingTimeout) {
            clearTimeout(waitingTimeout);
            waitingTimeout = null;
        }

        isAutoPosting = false;
        isWaitingDueToLimit = false;
        config.enabled = false;
        saveConfig();
        updateUI();
    }

    // 初始化
    function init() {
        initConfig();

        // 等待页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(createControlPanel, 2000);
            });
        } else {
            setTimeout(createControlPanel, 2000);
        }
    }

    // 注册菜单命令（油猴脚本菜单）
    GM_registerMenuCommand("自动水帖工具配置", function() {
        // 如果面板已最小化，先恢复
        if (config.panelMinimized) {
            config.panelMinimized = false;
            saveConfig();
        }
        createControlPanel();
    });

    // 启动初始化
    init();
})();
