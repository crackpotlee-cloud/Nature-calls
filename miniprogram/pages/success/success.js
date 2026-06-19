// pages/success/success.js - 反馈成功页逻辑
Page({
  onDone() {
    // 返回首页（使用 reLaunch 确保导航栈正确，而非假设返回栈深度为3）
    wx.reLaunch({
      url: '/pages/index/index'
    })
  },

  onUnload() {
    // 页面卸载时的清理工作
  }
})
