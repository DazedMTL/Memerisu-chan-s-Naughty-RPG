/*
AlwaysEscape.js

2016/9/28 version 1.0

  利用規約
　・MITライセンスに準じます。
  ・商用・非商用問わず使えます。
　・改変公開可能
*/

/*:
 * @plugindesc This plugin make success of escape command certain.
 * @author sauto
 *
 * @help This plugin does not provide plugin commands.
 */

/*:ja
 * @plugindesc バトル中の逃げるコマンドで100％逃げられます。
 * @author さうと
 *
 * @help このプラグインには、プラグインコマンドはありません。
 */

(function () {
  //rpg_manager.js
  BattleManager.processEscape = function () {
    $gameParty.performEscape();
    SoundManager.playEscape();
    var success = true;
    this.displayEscapeSuccessMessage();
    this._escaped = true;
    this.processAbort();
    return success;
  };
})();
