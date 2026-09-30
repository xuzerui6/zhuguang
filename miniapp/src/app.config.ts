export default defineAppConfig({
  pages: [
    "pages/index/index",
    "pages/coach-detail/index",
    "pages/booking/index",
    "pages/account-link/index",
    "pages/conversation/index",
    "pages/coach-request/index",
    "pages/profile-edit/index",
    "pages/learner-profile/index",
    "pages/coach-profile-edit/index",
    "pages/review/index",
    "pages/coach-application/index",
    "pages/legal/index",
    "pages/service-records/index",
    "pages/support/index",
  ],
  window: {
    backgroundColor: "#f5f7f6",
    backgroundTextStyle: "dark",
    navigationBarBackgroundColor: "#ffffff",
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
  lazyCodeLoading: "requiredComponents",
  ...(process.env.TARO_APP_FUZZY_LOCATION_ENABLED === "true" ? { permission: {
    "scope.userFuzzyLocation": {
      desc: "用于判断您当前位于北京还是长春并切换服务城市",
    },
  },
  requiredPrivateInfos: ["getFuzzyLocation"], } : {}),
  sitemapLocation: "sitemap.json",
});
