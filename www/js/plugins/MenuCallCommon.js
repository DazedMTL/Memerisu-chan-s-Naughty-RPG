//=============================================================================
// MenuCallCommon.js
//=============================================================================

/*:
 * @plugindesc Xボタンorマウスの右クリックでメニュー画面を開くかわりにコモンイベントを動作させるプラグイン
 * @author のん Twitter : non_non_cha
 *
 * @param ComEvent
 * @desc 開くためのコモンイベント
 * @default 1
 *
 * @param ComCloseEvent
 * @desc 閉じるためのコモンイベント
 * @default 1
 *
 * @param ComSwitch
 * @desc 開閉するために使うスイッチ番号
 * @default 1
 *
 * @help
 *
 * Xボタンorマウスの右クリックでメニュー画面を
 * 開くかわりにコモンイベントを動作させるプラグイン
 * 自作メニューとか作成したい場合にすごく便利。
 * 閉じたいときはスイッチをONに。
 * そうじゃない場合はOFFにしてください。
 * メニュー→アイテムの時のようなメニューからサブメニューに転移するときは
 * メニュー禁止を押してもらえればいけるはず。
 */

(function () {
  var parameters = PluginManager.parameters("MenuCallCommon");
  var Noncha_ComEvent = Number(parameters["ComEvent"] || 1);
  var Noncha_ComCloseEvent = Number(parameters["ComCloseEvent"] || 1);
  var Noncha_ComSwitch = Number(parameters["ComSwitch"] || 1);

  Scene_Map.prototype.updateCallMenu = function () {
    if (this.isMenuEnabled()) {
      if (this.isMenuCalled()) {
        this.menuCalling = true;
      }
      if (this.menuCalling && !$gamePlayer.isMoving()) {
        if (!$gameSwitches._data[Noncha_ComSwitch] == true) {
          $gameTemp.reserveCommonEvent(Noncha_ComEvent);
          this.menuCalling = false;
        } else if (!$gameSwitches._data[Noncha_ComSwitch] == false) {
          $gameTemp.reserveCommonEvent(Noncha_ComCloseEvent);
          this.menuCalling = false;
        }
      }
    } else {
      this.menuCalling = false;
    }
  };
})();
