//=============================================================================
// RPGツクールMV - LL_StandingPictureBattleMV.js v1.6.0
//-----------------------------------------------------------------------------
// ルルの教会 (Lulu's Church)
// https://nine-yusha.com/
//
// URL below for license details.
// https://nine-yusha.com/plugin/
//=============================================================================

/*:
 * @target MV
 * @plugindesc 戦闘中に立ち絵を自動表示します。
 * @author ルルの教会
 * @url https://nine-yusha.com/plugin-sbpicture/
 *
 * @help LL_StandingPictureBattleMV.js
 *
 * 戦闘中、下記のタイミングで立ち絵を自動表示します。
 *   ・戦闘開始時 (戦う・逃げる選択時)
 *   ・コマンド選択時
 *   ・被ダメージ時
 *   ・勝利時
 *   ・攻撃、防御、スキル発動時
 *   ・アイテム使用時
 *
 * 下記のように特定ステート、スイッチONで表示する立ち絵を複数定義できます。
 *   ・スイッチ1がONかつ毒状態の立ち絵
 *   ・スイッチ1がONの時の立ち絵
 *   ・毒状態の立ち絵
 *   ・スイッチ・ステート設定なしの通常立ち絵 (最低限必要)
 *
 * 残りHP％で立ち絵を切り替える:
 *   まず「残りHP％」を「100」に設定した立ち絵リストを作成します。
 *   上記をコピーして「残りHP％」を「50」に変更し、立ち絵リストを複製します。
 *   これでHPが半分以下になった場合、「50」に設定した立ち絵が呼ばれます。
 *   残りHP％毎に、複数立ち絵を定義することも可能です。
 *
 * 画像ファイルの表示優先順:
 *   1. ステートID、スイッチID両方に一致するもの
 *   2. ステートIDのみ一致するもの
 *   3. スイッチIDのみ一致するもの
 *   4. 通常立ち絵 (ステートID、スイッチIDともに設定なし)
 *   (上記の中で、残りHP％が最も低いものが優先して表示されます)
 *
 * 画像を反転させたい場合:
 *   X拡大率に「-100」と入力すると画像が反転します。
 *   (原点を左上にしている場合、X座標が画像横幅分左にずれます)
 *
 * プラグインコマンド:
 *   LL_StandingPictureBattleMV setEnabled true   # 立ち絵を表示に設定
 *   LL_StandingPictureBattleMV setEnabled false  # 立ち絵を非表示に設定
 *
 * 利用規約:
 *   ・著作権表記は必要ございません。
 *   ・利用するにあたり報告の必要は特にございません。
 *   ・商用・非商用問いません。
 *   ・R18作品にも使用制限はありません。
 *   ・ゲームに合わせて自由に改変していただいて問題ございません。
 *   ・プラグイン素材としての再配布（改変後含む）は禁止させていただきます。
 *
 * 作者: ルルの教会
 * 作成日: 2021/12/30
 *
 * @command setEnabled
 * @text 立ち絵表示ON・OFF
 * @desc 立ち絵の表示・非表示を一括制御します。
 *
 * @arg enabled
 * @text 立ち絵表示
 * @desc OFFにすると立ち絵が表示されなくなります。
 * @default true
 * @type boolean
 *
 * @param pictureListSettings
 * @text 立ち絵リスト
 * @desc ※この項目は使用しません
 *
 * @param sbCommandPictures
 * @text コマンド選択時
 * @desc コマンド選択中に表示する立ち絵を定義します。
 * ステート、スイッチ、残HP％毎に立ち絵を複数定義できます。
 * @default []
 * @type struct<sbCommandPictures>[]
 * @parent pictureListSettings
 *
 * @param sbDamagePictures
 * @text ダメージ時
 * @desc ダメージ時に表示する立ち絵を定義します。
 * ステート、スイッチ、残HP％毎に立ち絵を複数定義できます。
 * @default []
 * @type struct<sbDamagePictures>[]
 * @parent pictureListSettings
 *
 * @param sbWinPictures
 * @text 勝利時
 * @desc 戦闘勝利時に表示する立ち絵を定義します。
 * ステート、スイッチ、残HP％毎に立ち絵を複数定義できます。
 * @default []
 * @type struct<sbWinPictures>[]
 * @parent pictureListSettings
 *
 * @param sbActionPictures
 * @text 攻撃、防御、スキル発動時
 * @desc 攻撃、スキル、アイテム使用時に表示する立ち絵を定義します。
 * ステート、スイッチ、残HP％毎に立ち絵を複数定義できます。
 * @default []
 * @type struct<sbActionPictures>[]
 * @parent pictureListSettings
 *
 * @param sbItemPictures
 * @text アイテム使用時
 * @desc アイテム使用時に表示する立ち絵を定義します。
 * ステート、スイッチ、残HP％毎に立ち絵を複数定義できます。
 * @default []
 * @type struct<sbItemPictures>[]
 * @parent pictureListSettings
 *
 * @param startActorType
 * @text 戦闘開始時の表示アクター
 * @desc 戦う・逃げる選択時に表示されるアクターを選択してください。
 * @type select
 * @default none
 * @option 表示しない
 * @value none
 * @option 先頭のアクター
 * @value firstActor
 * @option ランダム
 * @value randomActor
 *
 * @param winActorType
 * @text 勝利時の表示アクター
 * @desc 勝利時に表示されるアクターを選択してください。
 * @type select
 * @default lastActor
 * @option 表示しない
 * @value none
 * @option 最後に行動したアクター
 * @value lastActor
 * @option 先頭のアクター
 * @value firstActor
 * @option ランダム
 * @value randomActor
 *
 * @param hiddenEnemyWindow
 * @text 敵選択時は非表示
 * @desc 敵選択時は立ち絵を非表示にします。
 * @default true
 * @type boolean
 *
 * @param hiddenActorWindow
 * @text 対象アクター選択時は非表示
 * @desc 対象アクター選択時は立ち絵を非表示にします。
 * @default false
 * @type boolean
 *
 * @param deathBeforeStates
 * @text 死亡時の直前ステート判定
 * @desc 死亡時に直前のステート状態で立ち絵を判定します。
 * 死亡時に専用の立ち絵を表示する場合はオフにしてください。
 * @default false
 * @type boolean
 */

/*~struct~sbCommandPictures:
 *
 * @param actorId
 * @text アクターID
 * @desc アクターIDです。立ち絵を定義するアクターを選択してください。
 * @type actor
 *
 * @param stateId
 * @text ステートID
 * @desc 特定ステートで立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は空白(なし)で設定してください。
 * @type state
 *
 * @param switchId
 * @text スイッチID
 * @desc スイッチONで立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は空白(なし)で設定してください。
 * @type switch
 *
 * @param hpPercentage
 * @text 残りHP％
 * @desc 残りHP％で立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は100％で設定してください。
 * @default 100
 * @min 0
 * @max 100
 * @type number
 *
 * @param imageName
 * @text 画像ファイル名
 * @desc 立ち絵として表示する画像ファイルを選択してください。
 * @dir img/pictures
 * @type file
 * @require 1
 *
 * @param origin
 * @text 原点
 * @desc 立ち絵の原点です。
 * @default upperleft
 * @type select
 * @option 左上
 * @value upperleft
 * @option 中央
 * @value center
 *
 * @param x
 * @text X座標
 * @desc 立ち絵の表示位置(X)です。
 * @default 464
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param y
 * @text Y座標
 * @desc 立ち絵の表示位置(Y)です。
 * @default 96
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param scaleX
 * @text X拡大率
 * @desc 立ち絵の拡大率(X)です。
 * @default 100
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param scaleY
 * @text Y拡大率
 * @desc 立ち絵の拡大率(Y)です。
 * @default 100
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param motion
 * @text モーション
 * @desc 再生モーションを選択してください。
 * @default floatrightfast
 * @type select
 * @option なし
 * @value none
 * @option 右からフロートイン (コマンド)
 * @value floatrightfast
 * @option 左からフロートイン (コマンド)
 * @value floatleftfast
 * @option 頷く
 * @value yes
 * @option ジャンプ
 * @value jump
 * @option 繰り返しジャンプ
 * @value jumploop
 * @option ガクガクし続ける
 * @value shakeloop
 * @option 横に揺れ続ける
 * @value noslowloop
 * @option 息づかい風
 * @value breathing
 * @option 息づかい風 (伸縮)
 * @value breathing2
 * @option 揺れる (ダメージ)
 * @value damage
 * @option 右からフロートイン (勝利)
 * @value floatright
 * @option 左からフロートイン (勝利)
 * @value floatleft
 * @option 左へスライド (攻撃)
 * @value stepleft
 * @option 右へスライド (攻撃)
 * @value stepright
 * @option 頭を下げる (防御)
 * @value headdown
 */

/*~struct~sbDamagePictures:
 *
 * @param actorId
 * @text アクターID
 * @desc アクターIDです。立ち絵を定義するアクターを選択してください。
 * @type actor
 *
 * @param stateId
 * @text ステートID
 * @desc 特定ステートで立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は空白(なし)で設定してください。
 * @type state
 *
 * @param switchId
 * @text スイッチID
 * @desc スイッチONで立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は空白(なし)で設定してください。
 * @type switch
 *
 * @param hpPercentage
 * @text 残りHP％
 * @desc 残りHP％で立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は100％で設定してください。
 * @default 100
 * @min 0
 * @max 100
 * @type number
 *
 * @param imageName
 * @text 画像ファイル名
 * @desc 立ち絵として表示する画像ファイルを選択してください。
 * @dir img/pictures
 * @type file
 * @require 1
 *
 * @param origin
 * @text 原点
 * @desc 立ち絵の原点です。
 * @default upperleft
 * @type select
 * @option 左上
 * @value upperleft
 * @option 中央
 * @value center
 *
 * @param x
 * @text X座標
 * @desc 立ち絵の表示位置(X)です。
 * @default 464
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param y
 * @text Y座標
 * @desc 立ち絵の表示位置(Y)です。
 * @default 96
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param scaleX
 * @text X拡大率
 * @desc 立ち絵の拡大率(X)です。
 * @default 100
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param scaleY
 * @text Y拡大率
 * @desc 立ち絵の拡大率(Y)です。
 * @default 100
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param motion
 * @text モーション
 * @desc 再生モーションを選択してください。
 * @default damage
 * @type select
 * @option なし
 * @value none
 * @option 右からフロートイン (コマンド)
 * @value floatrightfast
 * @option 左からフロートイン (コマンド)
 * @value floatleftfast
 * @option 頷く
 * @value yes
 * @option ジャンプ
 * @value jump
 * @option 繰り返しジャンプ
 * @value jumploop
 * @option ガクガクし続ける
 * @value shakeloop
 * @option 横に揺れ続ける
 * @value noslowloop
 * @option 息づかい風
 * @value breathing
 * @option 息づかい風 (伸縮)
 * @value breathing2
 * @option 揺れる (ダメージ)
 * @value damage
 * @option 右からフロートイン (勝利)
 * @value floatright
 * @option 左からフロートイン (勝利)
 * @value floatleft
 * @option 左へスライド (攻撃)
 * @value stepleft
 * @option 右へスライド (攻撃)
 * @value stepright
 * @option 頭を下げる (防御)
 * @value headdown
 */

/*~struct~sbWinPictures:
 *
 * @param actorId
 * @text アクターID
 * @desc アクターIDです。立ち絵を定義するアクターを選択してください。
 * @type actor
 *
 * @param stateId
 * @text ステートID
 * @desc 特定ステートで立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は空白(なし)で設定してください。
 * @type state
 *
 * @param switchId
 * @text スイッチID
 * @desc スイッチONで立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は空白(なし)で設定してください。
 * @type switch
 *
 * @param hpPercentage
 * @text 残りHP％
 * @desc 残りHP％で立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は100％で設定してください。
 * @default 100
 * @min 0
 * @max 100
 * @type number
 *
 * @param imageName
 * @text 画像ファイル名
 * @desc 立ち絵として表示する画像ファイルを選択してください。
 * @dir img/pictures
 * @type file
 * @require 1
 *
 * @param origin
 * @text 原点
 * @desc 立ち絵の原点です。
 * @default upperleft
 * @type select
 * @option 左上
 * @value upperleft
 * @option 中央
 * @value center
 *
 * @param x
 * @text X座標
 * @desc 立ち絵の表示位置(X)です。
 * @default 464
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param y
 * @text Y座標
 * @desc 立ち絵の表示位置(Y)です。
 * @default 96
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param scaleX
 * @text X拡大率
 * @desc 立ち絵の拡大率(X)です。
 * @default 100
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param scaleY
 * @text Y拡大率
 * @desc 立ち絵の拡大率(Y)です。
 * @default 100
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param motion
 * @text モーション
 * @desc 再生モーションを選択してください。
 * @default floatright
 * @type select
 * @option なし
 * @value none
 * @option 右からフロートイン (コマンド)
 * @value floatrightfast
 * @option 左からフロートイン (コマンド)
 * @value floatleftfast
 * @option 頷く
 * @value yes
 * @option ジャンプ
 * @value jump
 * @option 繰り返しジャンプ
 * @value jumploop
 * @option ガクガクし続ける
 * @value shakeloop
 * @option 横に揺れ続ける
 * @value noslowloop
 * @option 息づかい風
 * @value breathing
 * @option 息づかい風 (伸縮)
 * @value breathing2
 * @option 揺れる (ダメージ)
 * @value damage
 * @option 右からフロートイン (勝利)
 * @value floatright
 * @option 左からフロートイン (勝利)
 * @value floatleft
 * @option 左へスライド (攻撃)
 * @value stepleft
 * @option 右へスライド (攻撃)
 * @value stepright
 * @option 頭を下げる (防御)
 * @value headdown
 */

/*~struct~sbActionPictures:
 *
 * @param actorId
 * @text アクターID
 * @desc アクターIDです。立ち絵を定義するアクターを選択してください。
 * @type actor
 *
 * @param itemId
 * @text スキルID
 * @desc このスキルが発動された時に立ち絵が表示されます。
 * なしの場合、攻撃、防御含め全スキル発動時に表示されます。
 * @type skill
 *
 * @param stateId
 * @text ステートID
 * @desc 特定ステートで立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は空白(なし)で設定してください。
 * @type state
 *
 * @param switchId
 * @text スイッチID
 * @desc スイッチONで立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は空白(なし)で設定してください。
 * @type switch
 *
 * @param hpPercentage
 * @text 残りHP％
 * @desc 残りHP％で立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は100％で設定してください。
 * @default 100
 * @min 0
 * @max 100
 * @type number
 *
 * @param imageName
 * @text 画像ファイル名
 * @desc 立ち絵として表示する画像ファイルを選択してください。
 * @dir img/pictures
 * @type file
 * @require 1
 *
 * @param origin
 * @text 原点
 * @desc 立ち絵の原点です。
 * @default upperleft
 * @type select
 * @option 左上
 * @value upperleft
 * @option 中央
 * @value center
 *
 * @param x
 * @text X座標
 * @desc 立ち絵の表示位置(X)です。
 * @default 464
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param y
 * @text Y座標
 * @desc 立ち絵の表示位置(Y)です。
 * @default 96
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param scaleX
 * @text X拡大率
 * @desc 立ち絵の拡大率(X)です。
 * @default 100
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param scaleY
 * @text Y拡大率
 * @desc 立ち絵の拡大率(Y)です。
 * @default 100
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param motion
 * @text モーション
 * @desc 再生モーションを選択してください。
 * @default floatrightfast
 * @type select
 * @option なし
 * @value none
 * @option 右からフロートイン (コマンド)
 * @value floatrightfast
 * @option 左からフロートイン (コマンド)
 * @value floatleftfast
 * @option 頷く
 * @value yes
 * @option ジャンプ
 * @value jump
 * @option 繰り返しジャンプ
 * @value jumploop
 * @option ガクガクし続ける
 * @value shakeloop
 * @option 横に揺れ続ける
 * @value noslowloop
 * @option 息づかい風
 * @value breathing
 * @option 息づかい風 (伸縮)
 * @value breathing2
 * @option 揺れる (ダメージ)
 * @value damage
 * @option 右からフロートイン (勝利)
 * @value floatright
 * @option 左からフロートイン (勝利)
 * @value floatleft
 * @option 左へスライド (攻撃)
 * @value stepleft
 * @option 右へスライド (攻撃)
 * @value stepright
 * @option 頭を下げる (防御)
 * @value headdown
 */

/*~struct~sbItemPictures:
 *
 * @param actorId
 * @text アクターID
 * @desc アクターIDです。立ち絵を定義するアクターを選択してください。
 * @type actor
 *
 * @param itemId
 * @text アイテムID
 * @desc このアイテムを使用した時に立ち絵が表示されます。
 * なしにすると全アイテム使用時に表示されます。
 * @type item
 *
 * @param stateId
 * @text ステートID
 * @desc 特定ステートで立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は空白(なし)で設定してください。
 * @type state
 *
 * @param switchId
 * @text スイッチID
 * @desc スイッチONで立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は空白(なし)で設定してください。
 * @type switch
 *
 * @param hpPercentage
 * @text 残りHP％
 * @desc 残りHP％で立ち絵を変更したい場合に使用します。
 * 通常時の立ち絵は100％で設定してください。
 * @default 100
 * @min 0
 * @max 100
 * @type number
 *
 * @param imageName
 * @text 画像ファイル名
 * @desc 立ち絵として表示する画像ファイルを選択してください。
 * @dir img/pictures
 * @type file
 * @require 1
 *
 * @param origin
 * @text 原点
 * @desc 立ち絵の原点です。
 * @default upperleft
 * @type select
 * @option 左上
 * @value upperleft
 * @option 中央
 * @value center
 *
 * @param x
 * @text X座標
 * @desc 立ち絵の表示位置(X)です。
 * @default 464
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param y
 * @text Y座標
 * @desc 立ち絵の表示位置(Y)です。
 * @default 96
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param scaleX
 * @text X拡大率
 * @desc 立ち絵の拡大率(X)です。
 * @default 100
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param scaleY
 * @text Y拡大率
 * @desc 立ち絵の拡大率(Y)です。
 * @default 100
 * @min -2000
 * @max 2000
 * @type number
 *
 * @param motion
 * @text モーション
 * @desc 再生モーションを選択してください。
 * @default floatrightfast
 * @type select
 * @option なし
 * @value none
 * @option 右からフロートイン (コマンド)
 * @value floatrightfast
 * @option 左からフロートイン (コマンド)
 * @value floatleftfast
 * @option 頷く
 * @value yes
 * @option ジャンプ
 * @value jump
 * @option 繰り返しジャンプ
 * @value jumploop
 * @option ガクガクし続ける
 * @value shakeloop
 * @option 横に揺れ続ける
 * @value noslowloop
 * @option 息づかい風
 * @value breathing
 * @option 息づかい風 (伸縮)
 * @value breathing2
 * @option 揺れる (ダメージ)
 * @value damage
 * @option 右からフロートイン (勝利)
 * @value floatright
 * @option 左からフロートイン (勝利)
 * @value floatleft
 * @option 左へスライド (攻撃)
 * @value stepleft
 * @option 右へスライド (攻撃)
 * @value stepright
 * @option 頭を下げる (防御)
 * @value headdown
 */

(function () {
  "use strict";
  var pluginName = "LL_StandingPictureBattleMV";

  var parameters = PluginManager.parameters(pluginName);
  var sbCommandPictures = JSON.parse(parameters["sbCommandPictures"] || "null");
  var sbDamagePictures = JSON.parse(parameters["sbDamagePictures"] || "null");
  var sbWinPictures = JSON.parse(parameters["sbWinPictures"] || "null");
  var sbActionPictures = JSON.parse(parameters["sbActionPictures"] || "null");
  var sbItemPictures = JSON.parse(parameters["sbItemPictures"] || "null");
  var startActorType = String(parameters["startActorType"] || "none");
  var winActorType = String(parameters["winActorType"] || "lastActor");
  var hiddenEnemyWindow = eval(parameters["hiddenEnemyWindow"] || "true");
  var hiddenActorWindow = eval(parameters["hiddenActorWindow"] || "false");
  var deathBeforeStates = eval(parameters["deathBeforeStates"] || "false");

  var sbCommandPictureLists = [];
  if (sbCommandPictures) {
    sbCommandPictures.forEach(function (elm) {
      sbCommandPictureLists.push(JSON.parse(elm || "null"));
    });
  }
  var sbDamagePictureLists = [];
  if (sbDamagePictures) {
    sbDamagePictures.forEach(function (elm) {
      sbDamagePictureLists.push(JSON.parse(elm || "null"));
    });
  }
  var sbWinPictureLists = [];
  if (sbWinPictures) {
    sbWinPictures.forEach(function (elm) {
      sbWinPictureLists.push(JSON.parse(elm || "null"));
    });
  }
  var sbActionPictureLists = [];
  if (sbActionPictures) {
    sbActionPictures.forEach(function (elm) {
      sbActionPictureLists.push(JSON.parse(elm || "null"));
    });
  }
  var sbItemPictureLists = [];
  if (sbItemPictures) {
    sbItemPictures.forEach(function (elm) {
      sbItemPictureLists.push(JSON.parse(elm || "null"));
    });
  }

  // Plugin Command (for MV)
  var _Game_Interpreter_pluginCommand =
    Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command === pluginName) {
      switch (args[0]) {
        case "setEnabled":
          var enabled = eval(args[1] || "true");
          $gameSystem._StandingPictureBattleDisabled = !enabled;
          break;
      }
    }
  };

  // 独自変数定義
  var animationCount = 0;
  var refSbPicture = false;
  var motionSbPicture = "";
  var showDamageActorId = null;
  var activeCommandActorId = null;
  var activeDamageActorId = null;
  var activeActionActorId = null;
  var activeActionItemId = null;
  var activeActionDataClass = null;

  // アニメーションフレーム数定義
  var animationFrame = {
    yes: 24,
    yesyes: 48,
    no: 24,
    noslow: 48,
    jump: 24,
    jumpjump: 48,
    jumploop: 48,
    shake: 1,
    shakeloop: 1,
    runleft: 1,
    runright: 1,
    damage: 1,
    floatrightfast: 12,
    floatright: 48,
    floatleftfast: 12,
    floatleft: 48,
    noslowloop: 96,
    breathing: 96,
    breathing2: 96,
    stepleft: 24,
    stepright: 24,
    headdown: 12,
    none: 0,
  };

  //-----------------------------------------------------------------------------
  // 画像ファイル名を取得
  //
  // ※画像ファイルの検索順番ルール
  // 1. ステートID、スイッチID両方に一致するもの
  // 2. ステートIDのみ一致するもの
  // 3. スイッチIDのみ一致するもの
  // 4. 通常立ち絵 (ステートID、スイッチIDともに一致しない)
  // ※上記の中から、残りHP％が最も低いものが優先して表示される
  // ※それ以外で重複した場合、最も上部の立ち絵が表示される
  //-----------------------------------------------------------------------------
  var getImageName = function (actorId, pictureLists, itemId) {
    // for Before ES5
    if (typeof itemId === "undefined") {
      itemId = null;
    }

    // アクターのステート情報を取得
    var actorStates = [];
    if (actorId) {
      actorStates = $gameActors.actor(actorId)._states;

      // 死亡時に直前のステートIDで判定するか？
      if (actorStates.indexOf(1) !== -1 && deathBeforeStates) {
        actorStates = $gameActors.actor(actorId).beforeStates();
      }
    }
    var specificPicture = null;

    // アイテムID(スキルID)が指定されているか？
    // (処理を共通化するため、ここではskillIdも便宜的にitemIdとして扱う)
    if (itemId !== null) {
      pictureLists = pictureLists.filter(function (item) {
        if (Number(item.actorId) == actorId && Number(item.itemId) == itemId) {
          return true;
        }
      });
    }

    // ステートにかかっているか？
    if (actorStates.length) {
      // ステートID・スイッチIDが有効な立ち絵リストを検索
      specificPicture = pictureLists.filter(function (item, index) {
        if (
          Number(item.actorId) == actorId &&
          actorStates.indexOf(Number(item.stateId)) !== -1 &&
          $gameSwitches.value(Number(item.switchId))
        ) {
          return true;
        }
      });
      if (specificPicture.length)
        return checkHpPercentage(actorId, specificPicture);
      // ステートIDが有効な立ち絵リストを検索
      specificPicture = pictureLists.filter(function (item, index) {
        if (
          Number(item.actorId) == actorId &&
          actorStates.indexOf(Number(item.stateId)) !== -1 &&
          (Number(item.switchId) === 0 || !item.switchId)
        ) {
          return true;
        }
      });
      if (specificPicture.length)
        return checkHpPercentage(actorId, specificPicture);
    }

    // スイッチIDが有効な立ち絵リストを検索
    specificPicture = pictureLists.filter(function (item, index) {
      if (
        Number(item.actorId) == actorId &&
        (Number(item.stateId) === 0 || !item.stateId) &&
        $gameSwitches.value(Number(item.switchId))
      ) {
        return true;
      }
    });
    if (specificPicture.length)
      return checkHpPercentage(actorId, specificPicture);

    // 上記で見つからなかった場合、通常の立ち絵を検索
    var sbPicture = pictureLists.filter(function (item, index) {
      if (
        Number(item.actorId) == actorId &&
        (Number(item.stateId) === 0 || !item.stateId) &&
        (Number(item.switchId) === 0 || !item.switchId)
      )
        return true;
    });
    if (sbPicture.length) return checkHpPercentage(actorId, sbPicture);
  };

  var checkHpPercentage = function (actorId, pictureLists) {
    // アクターの残HP％を取得
    var hpRate = getHpRate(actorId);
    // 最もHP%が低い立ち絵を適用する
    var minHpRate = 100;
    var result = null;
    pictureLists.forEach(function (item) {
      if (
        hpRate <= Number(item.hpPercentage) &&
        minHpRate >= Number(item.hpPercentage)
      ) {
        result = item;
        minHpRate = Number(item.hpPercentage);
      } else if (!item.hpPercentage && minHpRate >= 100) {
        // プラグインパラメータが更新されていない場合、便宜的に100として扱う
        result = item;
        minHpRate = Number(item.hpPercentage);
      }
    });
    return result;
  };

  // アクターのHPレートを取得
  var getHpRate = function (actorId) {
    if (!$gameActors.actor(actorId)) return 0;
    return $gameActors.actor(actorId).mhp > 0
      ? ($gameActors.actor(actorId).hp / $gameActors.actor(actorId).mhp) * 100
      : 0;
  };

  // Battle Managerを拡張
  BattleManager.isPhase = function () {
    return this._phase;
  };
  BattleManager.isSubject = function () {
    return this._subject;
  };

  // Game Partyを拡張
  Game_Party.prototype.aliveBattleMembers = function () {
    // return this.allMembers()
    // 	.slice(0, this.maxBattleMembers())
    // 	.filter(actor => actor.isAppeared())
    // 	.filter(actor => actor.isAlive());

    // for Ver.1.5.1
    return this.allMembers()
      .slice(0, this.maxBattleMembers())
      .filter(function (actor) {
        return actor.isAppeared();
      })
      .filter(function (actor) {
        return actor.isAlive();
      });
  };
  // Game_Party.prototype.firstBattleMember = function() {
  // 	return this.allMembers()
  // 		.slice(0, 1)
  // 		.filter(actor => actor.isAppeared());
  // };
  // Game_Party.prototype.randomBattleMenber = function() {
  // 	var r = Math.randomInt(this.maxBattleMembers());
  // 	return this.allMembers()
  // 		.slice(r, r + 1)
  // 		.filter(actor => actor.isAppeared());
  // };

  var _Game_Battler_performActionStart =
    Game_Battler.prototype.performActionStart;
  Game_Battler.prototype.performActionStart = function (action) {
    _Game_Battler_performActionStart.apply(this, arguments);
    // スキルIDを取得
    activeActionItemId = action._item._itemId;
    activeActionDataClass = action._item._dataClass;
  };

  var _Game_Battler_performDamage = Game_Battler.prototype.performDamage;
  Game_Battler.prototype.performDamage = function () {
    _Game_Battler_performDamage.apply(this, arguments);
    // ダメージを受けたアクターIDを取得
    showDamageActorId = this._actorId;
  };

  // 死亡時の直前ステートIDを保持するため、Game_BattlerBaseを拡張
  var _Game_BattlerBase_initMembers = Game_BattlerBase.prototype.initMembers;
  Game_BattlerBase.prototype.initMembers = function () {
    _Game_BattlerBase_initMembers.apply(this, arguments);

    this._beforeStates = [];
  };

  var _Game_BattlerBase_die = Game_BattlerBase.prototype.die;
  Game_BattlerBase.prototype.die = function () {
    this._beforeStates = this._states;

    _Game_BattlerBase_die.apply(this, arguments);
  };

  Game_BattlerBase.prototype.beforeStates = function () {
    return this._beforeStates;
  };

  //-----------------------------------------------------------------------------
  // Ex Standing Picture Battle class
  //
  // 戦闘中立ち絵を表示する独自のクラスを追加定義します。

  class ExStandingPictureBattle {
    static create(elm) {
      // 立ち絵1
      elm._spbSprite = new Sprite_LL_SPicture();
      elm.addChild(elm._spbSprite);
      // バトル開始・終了フラグをオフ
      this._battleStart = false;
      this._battleEnd = false;
    }

    static update(elm) {
      // 初期設定
      var sbPicture = null;
      var isPhase = BattleManager.isPhase();
      var isInputting = BattleManager.isInputting();
      var isEscaped = BattleManager.isEscaped();
      var isAllDead = $gameParty.isAllDead();
      var commandActor = BattleManager.actor();
      var isSubject = BattleManager.isSubject();
      if (BattleManager._action) {
        if (BattleManager._action._subjectActorId) {
          this._lastActionActorId = BattleManager._action._subjectActorId;
        }
      }
      //-----------------------------------------------------------------------------
      // ターン開始時
      //-----------------------------------------------------------------------------
      if (isPhase == "start") {
        if (!this._battleStart) {
          // 生存しているアクターを取得
          this._aliveBattleMembers = $gameParty.aliveBattleMembers();
          // 先頭アクターIDを取得
          this._firstActorId =
            this._aliveBattleMembers.length > 0
              ? this._aliveBattleMembers[0]._actorId
              : null;
          // ランダムアクターID抽選
          this._randomActorId =
            this._aliveBattleMembers.length > 0
              ? this._aliveBattleMembers[
                  Math.floor(Math.random() * this._aliveBattleMembers.length)
                ]._actorId
              : null;
          this._battleStart = true;
        }
      }
      //-----------------------------------------------------------------------------
      // ターン終了時
      //-----------------------------------------------------------------------------
      if (isPhase == "turnEnd") {
        // 生存しているアクターを取得
        this._aliveBattleMembers = $gameParty.aliveBattleMembers();
        // 先頭アクターIDを取得
        this._firstActorId =
          this._aliveBattleMembers.length > 0
            ? this._aliveBattleMembers[0]._actorId
            : null;
        // ランダムアクターID抽選
        this._randomActorId =
          this._aliveBattleMembers.length > 0
            ? this._aliveBattleMembers[
                Math.floor(Math.random() * this._aliveBattleMembers.length)
              ]._actorId
            : null;
      }

      // 立ち絵を非表示に設定している場合、処理を中断
      if ($gameSystem._StandingPictureBattleDisabled) {
        elm._spbSprite.opacity = 0;
        return;
      }

      //-----------------------------------------------------------------------------
      // 戦闘終了時
      //-----------------------------------------------------------------------------
      if (isPhase == "battleEnd") {
        if (isEscaped) {
          // 逃走
        } else if (isAllDead) {
          // 全滅
        } else {
          if (!this._battleEnd) {
            // 生存しているアクターを取得
            var aliveBattleMembers = $gameParty.aliveBattleMembers();
            // 先頭アクターIDを取得
            this._firstActorId =
              aliveBattleMembers.length > 0
                ? aliveBattleMembers[0]._actorId
                : null;
            // ランダムアクターID抽選
            this._randomActorId =
              aliveBattleMembers.length > 0
                ? aliveBattleMembers[
                    Math.floor(Math.random() * aliveBattleMembers.length)
                  ]._actorId
                : null;
          }
          if (winActorType == "lastActor") {
            sbPicture = getImageName(
              this._lastActionActorId,
              sbWinPictureLists
            );
          } else if (winActorType == "randomActor") {
            sbPicture = getImageName(this._randomActorId, sbWinPictureLists);
          } else if (winActorType == "firstActor") {
            sbPicture = getImageName(this._firstActorId, sbWinPictureLists);
          }
          if (!this._battleEnd) {
            if (sbPicture) {
              refSbPicture = true;
              motionSbPicture = sbPicture.motion;
              animationCount = animationFrame[motionSbPicture];
              elm._spbSprite.opacity = 0;
            }
          }
        }
        this._battleEnd = true;
      }
      //-----------------------------------------------------------------------------
      // 被ダメージ時
      //-----------------------------------------------------------------------------
      if (showDamageActorId) {
        if (isPhase == "action") {
          sbPicture = getImageName(showDamageActorId, sbDamagePictureLists);
          if (sbPicture) {
            if (activeDamageActorId != showDamageActorId) {
              activeDamageActorId = showDamageActorId;
              refSbPicture = true;
              motionSbPicture = sbPicture.motion;
              animationCount = animationFrame[motionSbPicture];
              elm._spbSprite.opacity = 0;
            }
          }
        } else {
          showDamageActorId = null;
          sbPicture = null;
        }
      }
      //-----------------------------------------------------------------------------
      // アクション時
      //-----------------------------------------------------------------------------
      if (!showDamageActorId) {
        if (isPhase == "action") {
          // スキル発動時
          if (activeActionDataClass == "skill") {
            sbPicture = getImageName(
              isSubject._actorId,
              sbActionPictureLists,
              activeActionItemId
            );
            // 見つからなかった場合、スキルIDなしの立ち絵を再検索
            if (!sbPicture)
              sbPicture = getImageName(
                isSubject._actorId,
                sbActionPictureLists,
                0
              );
          }
          // アイテム使用時
          if (activeActionDataClass == "item") {
            sbPicture = getImageName(
              isSubject._actorId,
              sbItemPictureLists,
              activeActionItemId
            );
            // 見つからなかった場合、アイテムIDなしの立ち絵を再検索
            if (!sbPicture)
              sbPicture = getImageName(
                isSubject._actorId,
                sbItemPictureLists,
                0
              );
          }
          if (sbPicture) {
            if (activeActionActorId != isSubject._actorId) {
              activeActionActorId = isSubject._actorId;
              refSbPicture = true;
              motionSbPicture = sbPicture.motion;
              animationCount = animationFrame[motionSbPicture];
              elm._spbSprite.opacity = 0;

              activeCommandActorId = null;
            }
          }
        }
      }
      //-----------------------------------------------------------------------------
      // 戦う or 逃げる 選択時
      //-----------------------------------------------------------------------------
      if (isPhase == "turn" || isPhase == "input") {
        if (!commandActor && isInputting) {
          var selectStartActorId = null;
          if (startActorType == "firstActor") {
            sbPicture = getImageName(this._firstActorId, sbCommandPictureLists);
            selectStartActorId = this._firstActorId;
          } else if (startActorType == "randomActor") {
            sbPicture = getImageName(
              this._randomActorId,
              sbCommandPictureLists
            );
            selectStartActorId = this._randomActorId;
          }
          if (sbPicture) {
            sbPicture = JSON.parse(JSON.stringify(sbPicture));
            if (activeCommandActorId != selectStartActorId) {
              activeCommandActorId = selectStartActorId;
              refSbPicture = true;
              // 通常
              motionSbPicture = sbPicture.motion;
              animationCount = animationFrame[motionSbPicture];
              elm._spbSprite.opacity = 0;
            }
          }
        }
      }
      //-----------------------------------------------------------------------------
      // コマンド入力時
      //-----------------------------------------------------------------------------
      if (isPhase == "turn" || isPhase == "input") {
        if (commandActor) {
          sbPicture = getImageName(
            commandActor._actorId,
            sbCommandPictureLists
          );
          // HPレートを取得
          var hpRate =
            commandActor.mhp > 0
              ? (commandActor.hp / commandActor.mhp) * 100
              : 0;
          if (sbPicture) {
            sbPicture = JSON.parse(JSON.stringify(sbPicture));
            if (activeCommandActorId != commandActor._actorId) {
              activeCommandActorId = commandActor._actorId;
              refSbPicture = true;
              // 通常
              motionSbPicture = sbPicture.motion;
              animationCount = animationFrame[motionSbPicture];
              elm._spbSprite.opacity = 0;
            }
            // 敵選択時は非表示にする
            if (hiddenEnemyWindow) {
              if (elm._enemyWindow) {
                elm._spbSprite.visible = !elm._enemyWindow.active;
              }
            }

            // 対象アクター選択時は非表示にする
            if (hiddenActorWindow && elm._spbSprite.visible === true) {
              if (elm._actorWindow) {
                elm._spbSprite.visible = !elm._actorWindow.active;
              }
            }
          }
        }
      }

      // 立ち絵ピクチャ作成
      if (sbPicture && refSbPicture) {
        this.refresh(elm._spbSprite, sbPicture);
        refSbPicture = false;
      }

      // フェード処理
      if (sbPicture) {
        this.fadeIn(elm._spbSprite, sbPicture);
      } else {
        this.fadeOut(elm._spbSprite, sbPicture);
      }

      // 立ち絵モーション再生
      if (animationCount > 0) {
        animationCount = this.animation(
          elm._spbSprite,
          motionSbPicture,
          animationCount
        );
      }
    }

    static refresh(sSprite, sPicture) {
      sSprite.setPicture(sPicture);
      sSprite.showing = false;
      var calcScaleX = Number(sPicture.scaleX);
      var calcScaleY = Number(sPicture.scaleY);
      // 画像が読み込まれたあとに実行
      sSprite.bitmap.addLoadListener(
        function () {
          if (
            Number(sPicture.origin) != 1 &&
            String(sPicture.origin) != "center"
          ) {
            // 左上原点
            sSprite.x = Number(sPicture.x);
            sSprite.y = Number(sPicture.y);
            sSprite.originX = Number(sPicture.x);
            sSprite.originY = Number(sPicture.y);
          } else {
            // 中央原点
            sSprite.x =
              Number(sPicture.x) - (sSprite.width * calcScaleX) / 100 / 2;
            sSprite.y =
              Number(sPicture.y) - (sSprite.height * calcScaleY) / 100 / 2;
            sSprite.originX =
              Number(sPicture.x) - (sSprite.width * calcScaleX) / 100 / 2;
            sSprite.originY =
              Number(sPicture.y) - (sSprite.height * calcScaleY) / 100 / 2;
          }
          // 切替効果
          if (sSprite.opacity == 0) {
            //
          }
          sSprite.scale.x = calcScaleX / 100;
          sSprite.scale.y = calcScaleY / 100;
          sSprite.showing = true;
          // 非表示状態リセット
          sSprite.visible = true;
        }.bind(this)
      );
    }

    static fadeIn(sSprite, sPicture) {
      if (!sSprite.showing) return;
      if (sSprite.opacity >= 255) {
        sSprite.opening = false;
        sSprite.opacity = 255;
        return;
      }
      sSprite.opening = true;
      sSprite.closing = false;
      sSprite.opacity += 24;
    }

    static fadeOut(sSprite, sPicture) {
      if (sSprite.opacity == 0) {
        activeCommandActorId = null;
        activeDamageActorId = null;
        activeActionActorId = null;
        sSprite.closing = false;
        return;
      }
      sSprite.closing = true;
      if (!sPicture) {
        //sSprite.opacity = 0;
        //return;
      }
      sSprite.opacity -= 24;
    }

    static animation(sSprite, sMotion, animationCount) {
      if (!sSprite.showing) return animationCount;
      if (sMotion == "yes") {
        if (animationCount > 12) {
          sSprite.y += 2;
        } else {
          sSprite.y -= 2;
        }
        animationCount -= 1;
      }
      if (sMotion == "yesyes") {
        if (animationCount > 36) {
          sSprite.y += 2;
        } else if (animationCount > 24) {
          sSprite.y -= 2;
        } else if (animationCount > 12) {
          sSprite.y += 2;
        } else {
          sSprite.y -= 2;
        }
        animationCount -= 1;
      }
      if (sMotion == "no") {
        if (animationCount > 18) {
          sSprite.x += 2;
        } else if (animationCount > 6) {
          sSprite.x -= 2;
        } else {
          sSprite.x += 2;
        }
        animationCount -= 1;
      }
      if (sMotion == "noslow") {
        if (animationCount > 36) {
          sSprite.x += 1;
        } else if (animationCount > 12) {
          sSprite.x -= 1;
        } else {
          sSprite.x += 1;
        }
        animationCount -= 1;
      }
      if (sMotion == "jump") {
        if (animationCount > 12) {
          sSprite.y -= 2;
        } else {
          sSprite.y += 2;
        }
        animationCount -= 1;
      }
      if (sMotion == "jumpjump") {
        if (animationCount > 36) {
          sSprite.y -= 2;
        } else if (animationCount > 24) {
          sSprite.y += 2;
        } else if (animationCount > 12) {
          sSprite.y -= 2;
        } else {
          sSprite.y += 2;
        }
        animationCount -= 1;
      }
      if (sMotion == "jumploop") {
        if (animationCount > 36) {
          sSprite.y -= 2;
        } else if (animationCount > 24) {
          sSprite.y += 2;
        }
        animationCount -= 1;
        if (animationCount == 0) animationCount = animationFrame["jumploop"];
      }
      if (sMotion == "shake") {
        if (animationCount <= 2) {
          sSprite.x -= 2;
          animationCount += 1;
        } else if (animationCount <= 4) {
          sSprite.y -= 2;
          animationCount += 1;
        } else if (animationCount <= 6) {
          sSprite.x += 4;
          sSprite.y += 4;
          animationCount += 1;
        } else if (animationCount <= 8) {
          sSprite.y -= 2;
          animationCount += 1;
        } else if (animationCount == 9) {
          sSprite.x -= 2;
          animationCount += 1;
        } else if (animationCount == 10) {
          sSprite.x -= 2;
          animationCount = 0;
        }
      }
      if (sMotion == "shakeloop") {
        if (animationCount <= 2) {
          sSprite.x -= 1;
          animationCount += 1;
        } else if (animationCount <= 4) {
          sSprite.y -= 1;
          animationCount += 1;
        } else if (animationCount <= 6) {
          sSprite.x += 2;
          sSprite.y += 2;
          animationCount += 1;
        } else if (animationCount <= 8) {
          sSprite.y -= 1;
          animationCount += 1;
        } else if (animationCount <= 10) {
          sSprite.x -= 1;
          animationCount += 1;
        }
        if (animationCount > 10) animationCount = 1;
      }
      if (sMotion == "runleft") {
        sSprite.x -= 16;
        if (sSprite.x < -2000) animationCount = 0;
      }
      if (sMotion == "runright") {
        sSprite.x += 16;
        if (sSprite.x > 2000) animationCount = 0;
      }
      //
      if (sMotion == "damage") {
        if (animationCount <= 2) {
          sSprite.x -= 4;
          animationCount += 1;
        } else if (animationCount <= 4) {
          sSprite.y -= 4;
          animationCount += 1;
        } else if (animationCount <= 6) {
          sSprite.x += 8;
          sSprite.y += 8;
          animationCount += 1;
        } else if (animationCount <= 8) {
          sSprite.y -= 4;
          animationCount += 1;
        } else if (animationCount == 9) {
          sSprite.x -= 4;
          animationCount += 1;
        } else if (animationCount == 10) {
          sSprite.x -= 4;
          animationCount = 0;
        }
      }
      if (sMotion == "floatrightfast") {
        if (animationCount == 12) {
          sSprite.x += 22;
        } else {
          sSprite.x -= 2;
        }
        animationCount -= 1;
      }
      if (sMotion == "floatright") {
        if (animationCount == 48) {
          sSprite.x += 47;
        } else {
          sSprite.x -= 1;
        }
        animationCount -= 1;
      }
      if (sMotion == "floatleftfast") {
        if (animationCount == 12) {
          sSprite.x -= 22;
        } else {
          sSprite.x += 2;
        }
        animationCount -= 1;
      }
      if (sMotion == "floatleft") {
        if (animationCount == 48) {
          sSprite.x -= 47;
        } else {
          sSprite.x += 1;
        }
        animationCount -= 1;
      }
      if (sMotion == "noslowloop") {
        if (animationCount > 72) {
          sSprite.x += 0.25;
        } else if (animationCount > 24) {
          sSprite.x -= 0.25;
        } else {
          sSprite.x += 0.25;
        }
        animationCount -= 1;
        if (animationCount == 0) animationCount = animationFrame["noslowloop"];
      }
      if (sMotion == "breathing") {
        if (animationCount > 72) {
          sSprite.y += 0.5;
        } else if (animationCount > 48) {
          sSprite.y -= 0.5;
        } else {
        }
        animationCount -= 1;
        if (animationCount == 0) animationCount = animationFrame["breathing"];
      }
      if (sMotion == "breathing2") {
        if (animationCount > 48) {
          // sSprite.anchor.y = 1;
          sSprite.y -= sSprite.height * 0.0003;
          sSprite.scale.y += 0.0003;
        } else {
          // sSprite.anchor.y = 1;
          sSprite.y += sSprite.height * 0.0003;
          sSprite.scale.y -= 0.0003;
        }
        animationCount -= 1;
        if (animationCount == 0) animationCount = animationFrame["breathing2"];
      }
      if (sMotion == "stepleft") {
        if (animationCount > 12) {
          sSprite.x -= 2;
        } else {
          sSprite.x += 2;
        }
        animationCount -= 1;
      }
      if (sMotion == "stepright") {
        if (animationCount > 12) {
          sSprite.x += 2;
        } else {
          sSprite.x -= 2;
        }
        animationCount -= 1;
      }
      if (sMotion == "headdown") {
        sSprite.y += 2;
        animationCount -= 1;
      }
      return animationCount;
    }
  }

  var _Scene_Battle_update = Scene_Battle.prototype.update;
  Scene_Battle.prototype.update = function () {
    _Scene_Battle_update.apply(this, arguments);
    ExStandingPictureBattle.update(this);
  };

  var _Scene_Battle_createSpriteset = Scene_Battle.prototype.createSpriteset;
  Scene_Battle.prototype.createSpriteset = function () {
    _Scene_Battle_createSpriteset.apply(this, arguments);
    ExStandingPictureBattle.create(this);
  };

  //-----------------------------------------------------------------------------
  // Sprite_LL_SPicture
  //
  // 立ち絵を表示するための独自のスプライトを追加定義します。

  function Sprite_LL_SPicture() {
    this.initialize.apply(this, arguments);
  }

  Sprite_LL_SPicture.prototype = Object.create(Sprite.prototype);
  Sprite_LL_SPicture.prototype.constructor = Sprite_LL_SPicture;

  Sprite_LL_SPicture.prototype.initialize = function () {
    Sprite.prototype.initialize.call(this);

    this.bitmap = null;
    this.opacity = 0;
    this.opening = false;
    this.closing = false;
    this.originX = 0;
    this.originY = 0;
    this.showing = false;

    this.setOverlayBitmap();
    this.initMembers();
  };

  Sprite_LL_SPicture.prototype.setOverlayBitmap = function () {
    //
  };

  Sprite_LL_SPicture.prototype.initMembers = function () {
    //
  };

  Sprite_LL_SPicture.prototype.update = function () {
    Sprite.prototype.update.call(this);
  };

  Sprite_LL_SPicture.prototype.setPicture = function (sPicture) {
    // ベース画像
    this.bitmap = null;
    this.bitmap = ImageManager.loadPicture(sPicture.imageName);
  };

  Sprite_LL_SPicture.prototype.setBlendColor = function (color) {
    Sprite.prototype.setBlendColor.call(this, color);
  };

  Sprite_LL_SPicture.prototype.setColorTone = function (tone) {
    Sprite.prototype.setColorTone.call(this, tone);
  };

  Sprite_LL_SPicture.prototype.setBlendMode = function (mode) {
    this.blendMode = mode;
  };
})();
