// pages/contribute/contribute.js - 贡献厕所页逻辑
const api = require('../../utils/api')

Page({
  data: {
    currentStep: 1,
    totalSteps: 6,
    formData: {
      location: null,
      name: '',
      type: '',
      landmark: '',
      floor: '',
      direction: '',
      access_type: '',
      facilities: {
        seat: false,
        squat: false,
        accessible: false,
        baby_station: false,
        paper: false,
        soap: false,
        hand_dryer: false
      }
    },
    toiletTypes: ['商场厕所', '公厕', '地铁厕所', '餐饮厕所', '公园厕所', '加油站厕所', '酒店厕所', '医院厕所'],
    accessTypes: ['自由进入', '需安检', '建议消费', '必须消费', '需门禁'],
    facilities: [
      { key: 'seat', name: '坐便', icon: '🚽' },
      { key: 'squat', name: '蹲坑', icon: '🚾' },
      { key: 'accessible', name: '无障碍', icon: '♿' },
      { key: 'baby_station', name: '母婴台', icon: '👶' },
      { key: 'paper', name: '有纸', icon: '🧻' },
      { key: 'soap', name: '洗手液', icon: '🧴' },
      { key: 'hand_dryer', name: '烘手机', icon: '💨' }
    ]
  },

  // 选择位置
  onChooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        // 不做地域限制，用户在全国任何位置均可贡献厕所
        const lat = res.latitude
        const lng = res.longitude
        this.setData({
          'formData.location': {
            lat,
            lng,
            address: res.address || res.name
          }
        })
      },
      fail: () => {
        wx.showToast({ title: '需要授权位置权限', icon: 'none' })
      }
    })
  },

  // 输入
  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`formData.${field}`]: e.detail.value
    })
  },

  // 选择类型
  onSelectType(e) {
    const value = e.currentTarget.dataset.value
    // 判断是类型还是准入
    const field = this.data.toiletTypes.includes(value) ? 'type' : 'access_type'
    this.setData({
      [`formData.${field}`]: value
    })
  },

  // 切换设施
  onToggleFacility(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      [`formData.facilities.${key}`]: !this.data.formData.facilities[key]
    })
  },

  // 下一步
  onNextStep() {
    if (!this.validateStep()) return
    if (this.data.currentStep < this.data.totalSteps) {
      this.setData({ currentStep: this.data.currentStep + 1 })
    }
  },

  // 上一步
  onPrevStep() {
    if (this.data.currentStep > 1) {
      this.setData({ currentStep: this.data.currentStep - 1 })
    }
  },

  // 验证当前步骤
  validateStep() {
    const step = this.data.currentStep
    const f = this.data.formData

    if (step === 1) {
      if (!f.location) { wx.showToast({ title: '请选择位置', icon: 'none' }); return false }
    }
    if (step === 2) {
      if (!f.name.trim()) { wx.showToast({ title: '请输入名称', icon: 'none' }); return false }
      if (!f.type) { wx.showToast({ title: '请选择类型', icon: 'none' }); return false }
    }
    if (step === 3) {
      if (!f.landmark.trim()) { wx.showToast({ title: '请输入锚点品牌', icon: 'none' }); return false }
      if (!f.floor.trim()) { wx.showToast({ title: '请输入楼层', icon: 'none' }); return false }
      if (!f.direction.trim()) { wx.showToast({ title: '请输入路径指引', icon: 'none' }); return false }
    }
    if (step === 4) {
      if (!f.access_type) { wx.showToast({ title: '请选择准入类型', icon: 'none' }); return false }
    }
    return true
  },

  // 提交
  async onSubmit() {
    if (!this.validateStep()) return

    try {
      wx.showLoading({ title: '提交中...' })
      await api.submitContribute(this.data.formData)
      wx.hideLoading()
      
      wx.showModal({
        title: '提交成功',
        content: '厕所数据已进入审核队列\n审核通过后将上线展示',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    }
  },

  onBack() {
    wx.navigateBack()
  }
})
