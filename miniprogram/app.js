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
    const systemInfo = wx.getSystemInfoSync()
    this.globalData.systemInfo = systemInfo
    this.globalData.statusBarHeight = systemInfo.statusBarHeight
    this.globalData.screenWidth = systemInfo.screenWidth
    this.globalData.screenHeight = systemInfo.screenHeight

    const constants = require('./utils/constants')

    const hour = new Date().getHours()
    this.globalData.isNight = hour < constants.NIGHT_END_HOUR || hour >= constants.NIGHT_START_HOUR
    this.globalData.isMealTime = constants.MEAL_HOURS.some(
      range => hour >= range.start && hour <= range.end
    )

    this.wxLogin()
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
      },
      fail: () => {
        // 保留默认值
      }
    })
  }
})
