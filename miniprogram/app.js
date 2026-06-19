App({
  globalData: {
    userInfo: null,
    token: null,
    mapKey: '5CRBZ-IFJW7-YE7XS-HBX5B-R2HSJ-SLBCC',
    currentLocation: {
      lat: 30.658,
      lng: 104.082,
      name: '成都 · 春熙路IFS附近'
    },
    currentScene: 'smart',
    currentToilet: null,
    isNight: false,
    isMealTime: false
  },

  onLaunch() {
    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync()
    this.globalData.systemInfo = systemInfo
    this.globalData.statusBarHeight = systemInfo.statusBarHeight
    this.globalData.screenWidth = systemInfo.screenWidth
    this.globalData.screenHeight = systemInfo.screenHeight

    // 加载共享常量
    const constants = require('./utils/constants')

    // 检查夜间模式（使用共享常量）
    const hour = new Date().getHours()
    this.globalData.isNight = hour < constants.NIGHT_END_HOUR || hour >= constants.NIGHT_START_HOUR
    this.globalData.isMealTime = constants.MEAL_HOURS.some(
      range => hour >= range.start && hour <= range.end
    )

    // 微信登录
    this.wxLogin()

    // 获取位置
    this.getLocation()
  },

  wxLogin() {
    const api = require('./utils/api')
    wx.login({
      success: (res) => {
        if (res.code) {
          api.login(res.code).then(data => {
            this.globalData.token = data.token
            this.globalData.userInfo = data.user
            console.log('登录成功, token:', data.token)
          }).catch(err => {
            console.error('登录失败:', err)
          })
        }
      }
    })
  },

  getLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.globalData.currentLocation = {
          lat: res.latitude,
          lng: res.longitude,
          name: '当前位置'
        }
        console.log('[app.js] 获取定位成功:', this.globalData.currentLocation)
      },
      fail: () => {
        // 无法获取定位时，保持现有值（已在 onLaunch 前初始化为默认值）
        // 但给一个提示，让用户知道定位失败
        console.warn('[app.js] 获取定位失败，将使用默认位置')
      }
    })
  }
})
