include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-droidnet-scrcpy
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Hilman Maulana <hilman0.0maulana@gmail.com>

PKG_BUILD_DEPENDS:=node/host

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-droidnet-scrcpy
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=Screen mirroring for DroidNet using ws-scrcpy
  URL:=https://github.com/NetrisTV/ws-scrcpy
  DEPENDS:=+luci-app-droidnet +node +node-npm
  PKGARCH:=all
endef

define Package/luci-app-droidnet-scrcpy/description
  Web-based screen mirroring and remote control for Android devices
  using ws-scrcpy. Provides full touch, keyboard, and mouse input
  support directly in the browser.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/* $(PKG_BUILD_DIR)/
endef

define Build/Compile
	cd $(PKG_BUILD_DIR) && npm install https://github.com/NetrisTV/ws-scrcpy.git --production
endef

define Package/luci-app-droidnet-scrcpy/install
	$(INSTALL_DIR) $(1)/usr/lib/droidnet-scrcpy
	$(CP) $(PKG_BUILD_DIR)/node_modules/ws-scrcpy $(1)/usr/lib/droidnet-scrcpy/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/server.js $(1)/usr/lib/droidnet-scrcpy/
	
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/droidnet-scrcpy $(1)/etc/init.d/
	
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/droidnet-scrcpy $(1)/etc/config/
	
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/droidnet
	$(INSTALL_DATA) ./files/www/luci-static/resources/view/droidnet/scrcpy.js \
		$(1)/www/luci-static/resources/view/droidnet/
	
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-droidnet-scrcpy.json \
		$(1)/usr/share/luci/menu.d/
	
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./files/usr/share/rpcd/acl.d/droidnet-scrcpy.json \
		$(1)/usr/share/rpcd/acl.d/
endef

define Package/luci-app-droidnet-scrcpy/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/droidnet-scrcpy enable
	/etc/init.d/rpcd restart
}
exit 0
endef

define Package/luci-app-droidnet-scrcpy/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/droidnet-scrcpy stop
	/etc/init.d/droidnet-scrcpy disable
}
exit 0
endef

$(eval $(call BuildPackage,luci-app-droidnet-scrcpy))
