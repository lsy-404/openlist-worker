import type zh from "../zh-CN/shell"

const messages: typeof zh = {
  siteFallback: "Drive",
  offline: {
    title: "Can't connect to the server",
    detail: "Check your network connection and try again. If the problem persists, the server may be under maintenance.",
  },
  header: {
    login: "Sign in",
    account: "Account",
    groups: "Identity groups",
    logout: "Sign out",
    language: "Language",
    toggleTheme: "Switch between light and dark theme",
    admin: "Admin console",
    openNav: "Open navigation",
    closeNav: "Close navigation",
    navigation: "Navigation",
  },
  roles: { admin: "Administrator", user: "User", guest: "Guest" },
  session: { expired: "Your session expired. You are now browsing as a guest." },
}
export default messages
