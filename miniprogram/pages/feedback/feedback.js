// pages/feedback/feedback.js - 反馈页逻辑
const api = require('../../utils/api')

// 反馈降频存储键名
const FEEDBACK_SKIP_KEY = 'sanji_feedback_skip'

// 获取降频状态
function getFeedbackSkipState() {
  try {
    const raw = wx.getStorageSync(FEEDBACK_SKIP_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return { skipCount: 0, arrivalCount: 0 }
}

// 保存降频状态
function saveFeedbackSkipState(state) {
  try {
    wx.setStorageSync(FEEDBACK_SKIP_KEY, JSON.stringify(state))
  } catch (e) {}
}

// 判断是否应该弹出反馈
// 规则：连续跳过2次后，每3次到达弹1次
//   - 到达1: 弹出
//   - 到达2: 弹出
//   - 到达3: 不弹出（跳过第1次）
//   - 到达4: 不弹出（跳过第2次）
//   - 到达5: 弹出（第3次到达弹1次）
//   - 以此类推
function shouldShowFeedback() {
  const state = getFeedbackSkipState()
  state.arrivalCount++
  
  // 连续跳过2次后，每3次到达弹1次
  // 当前到达是第 N 次，检查是否应该弹出
  const shouldShow = !(state.skipCount >= 2 && state.arrivalCount % 3 !== 0)
  
  if (shouldShow) {
    // 重置到达计数
    state.arrivalCount = 0
  }
  
  saveFeedbackSkipState(state)
  return shouldShow
}

// 记录跳过（用户点击了"跳过"按钮）
function recordFeedbackSkip() {
  const state = getFeedbackSkipState()
  state.skipCount++
  state.arrivalCount = 0
  saveFeedbackSkipState(state)
}

Page({
  data: {
    toiletId: '',
    answers: {
      status: '',
      cleanliness: '',
      queue: '',
      paper: ''
    },
    canSubmit: false
  },

  onLoad(options) {
    const toiletId = options.id || ''
    this.setData({ toiletId })
  },

  // 选择选项
  onSelect(e) {
    const { field, value } = e.currentTarget.dataset
    const answers = { ...this.data.answers }
    answers[field] = value
    this.setData({ answers })
    this.checkCanSubmit()
  },

  // 检查是否可提交（至少选了Q1）
  checkCanSubmit() {
    const canSubmit = !!this.data.answers.status
    this.setData({ canSubmit })
  },

  // 提交反馈
  async onSubmit() {
    if (!this.data.canSubmit) {
      wx.showToast({ title: '请至少选择"能用/不能用"', icon: 'none' })
      return
    }

    try {
      const app = getApp()
      const loc = app.globalData.currentLocation

      await api.submitFeedback({
        toilet_id: this.data.toiletId,
        status: this.data.answers.status,
        cleanliness: this.data.answers.cleanliness,
        queue: this.data.answers.queue,
        paper: this.data.answers.paper,
        user_lat: loc.lat,
        user_lng: loc.lng
      })

      // 跳转成功页
      wx.redirectTo({
        url: '/pages/success/success'
      })
    } catch (err) {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    }
  },

  // 跳过
  onSkip() {
    recordFeedbackSkip()
    wx.navigateBack({ delta: 2 }) // 返回首页
  }
})

module.exports = {
  shouldShowFeedback
}
