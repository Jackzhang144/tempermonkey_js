// ==UserScript==
// @name         购物车全选功能优化版
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  为购物车页面添加全选按钮，解决多个按钮和页面跳转后消失的问题
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let selectAllAdded = false; // 标记是否已添加全选按钮

    // 主函数：添加全选功能
    function addSelectAllFeature() {
        // 如果已经添加过全选按钮，则不再添加
        if (selectAllAdded || document.getElementById('customSelectAllHeader')) {
            return;
        }

        // 查找购物车表格
        const cartTables = document.querySelectorAll('table[title="Your Shopping Cart"]');
        if (cartTables.length === 0) {
            return;
        }

        const cartTable = cartTables[0];

        // 查找表头行
        const headerRow = cartTable.querySelector('thead tr');
        if (!headerRow) {
            return;
        }

        // 创建全选框单元格
        const selectAllCell = document.createElement('th');
        selectAllCell.scope = 'col';
        selectAllCell.className = 'ps_grid-col';
        selectAllCell.style.textAlign = 'center';
        selectAllCell.id = 'customSelectAllHeader';

        const selectAllDiv = document.createElement('div');
        selectAllDiv.className = 'ps_box_grid-col';

        const selectAllLabelDiv = document.createElement('div');
        selectAllLabelDiv.className = 'ps_grid-col-label';
        selectAllLabelDiv.style.display = 'flex';
        selectAllLabelDiv.style.alignItems = 'center';
        selectAllLabelDiv.style.justifyContent = 'center';

        // 创建全选复选框
        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.id = 'selectAllCheckbox';
        selectAllCheckbox.style.margin = '0 5px 0 0';
        selectAllCheckbox.style.cursor = 'pointer';
        selectAllCheckbox.addEventListener('change', toggleAllSelections);

        // 创建标签
        const selectAllLabel = document.createElement('span');
        selectAllLabel.textContent = '全选';
        selectAllLabel.style.cursor = 'pointer';
        selectAllLabel.style.fontSize = '12px';

        // 组装元素
        selectAllLabelDiv.appendChild(selectAllCheckbox);
        selectAllLabelDiv.appendChild(selectAllLabel);
        selectAllDiv.appendChild(selectAllLabelDiv);
        selectAllCell.appendChild(selectAllDiv);

        // 将全选单元格插入到表头行的第一个位置
        headerRow.insertBefore(selectAllCell, headerRow.firstChild);

        // 更新标记
        selectAllAdded = true;

        console.log("全选按钮已添加");

        // 添加样式
        addStyles();
    }

    function toggleAllSelections(event) {
        const isChecked = event.target.checked;
        const checkboxes = document.querySelectorAll('input[id^="DERIVED_REGFRM1_SSR_SELECT"][type="checkbox"]');

        checkboxes.forEach(checkbox => {
            if (checkbox.checked !== isChecked) {
                checkbox.checked = isChecked;

                // 触发change事件以确保系统检测到状态变化
                const changeEvent = new Event('change', { bubbles: true });
                checkbox.dispatchEvent(changeEvent);

                // 触发click事件以确保UI更新
                const clickEvent = new Event('click', { bubbles: true });
                checkbox.dispatchEvent(clickEvent);
            }
        });
    }

    function addStyles() {
        // 添加自定义样式
        const style = document.createElement('style');
        style.textContent = `
            #selectAllCheckbox {
                vertical-align: middle;
            }
            #customSelectAllHeader {
                min-width: 60px;
            }
        `;
        document.head.appendChild(style);
    }

    // 使用MutationObserver监听DOM变化
    const observer = new MutationObserver(function(mutations) {
        // 检查是否有节点添加
        let shouldCheck = false;
        for (let mutation of mutations) {
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                shouldCheck = true;
                break;
            }
        }

        if (shouldCheck) {
            // 检查是否添加了购物车表格
            const cartTables = document.querySelectorAll('table[title="Your Shopping Cart"]');
            if (cartTables.length > 0) {
                // 如果已经添加过全选按钮但不存在，则重置标记
                if (selectAllAdded && !document.getElementById('customSelectAllHeader')) {
                    selectAllAdded = false;
                }

                // 添加全选功能
                addSelectAllFeature();
            }
        }
    });

    // 开始观察DOM变化
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 初始检查
    if (document.querySelector('table[title="Your Shopping Cart"]')) {
        addSelectAllFeature();
    }
})();
