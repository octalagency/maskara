=== Maskara Order Verification for WooCommerce ===
Contributors: maskara
Tags: woocommerce, cod, order verification, bangla, maskara, pathao, courier
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.5.13
License: GPLv2 or later

WooCommerce COD order verification via Maskara AI voice. Confirm = Completed + Pathao; miss/cancel = Cancelled.

== Description ==

* Order sync to Maskara for Bangla AI voice confirmation
* On confirm: WooCommerce status Completed + Pathao courier auto-deploy
* On miss / cancel: WooCommerce status Cancelled
* Orders list: Verify, Calls (x/10), Courier stage columns
* Plugins page: Check for updates
* Dashboard: Delivered, In Transit, Returned, Success Rate

== Installation ==

1. Maskara merchant dashboard - API Keys - Create new key
2. WordPress Admin - Plugins - Deactivate and Delete old Maskara plugin (if installed)
3. Plugins - Add New - Upload Plugin - maskara-woocommerce.zip - Install - Activate
4. Maskara - Settings - API URL, API Key, enable Pathao
5. Test Connection - Connect to Maskara

== Changelog ==

= 1.5.10 =
* Parse city from free-text address (চট্টগ্রাম / Chittagong) when Woo city field empty
* Pathao auto-deploy after verify when city is only in address line

= 1.5.9 =
* Sync cancelled/refunded/failed Woo orders to Maskara (stops calls, dashboard CANCELLED)

= 1.5.2 =
* WordPress-safe zip packaging (fixes upload / incompatible archive)
* ASCII plugin headers for broader host compatibility
* Old short download URLs now serve full package

= 1.5.1 =
* Fixed verify Pathao deploy then Completed
* Fixed call count on Orders list
* Safer self-updater

= 1.5.0 =
* Verify → Completed + Pathao auto-deploy
* No-answer / cancel → Cancelled

= 1.4.0 =
* Verify / Calls / Courier columns

= 1.3.0 =
* Courier dashboard + Pathao status sync
