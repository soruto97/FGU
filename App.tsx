
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';

const DEFAULT_MAX_POINTS = 700;
const MIN_ATTACK_PERCENT = 15;
const MAX_NAME_LENGTH = 14;

const STAT_FIELDS = ['HP', 'ATK', 'MATK', 'DEF', 'MDEF', 'CRT', 'CDMG', 'HIT', 'SPD', 'AVD', 'LUK'] as const;

const STAT_DESCRIPTIONS: Record<string, string> = {
  NAME: 'キャラの名前。',
  HP: '体力。0になると負け。バトル開始時に基本値として200が加算されます。',
  ATK: '物理攻撃力。バトル開始時に基本値として10が加算されます。',
  DEF: '物理防御力。相手の物理ダメージを「DEF * 3 / 4」分だけ軽減します。',
  MATK: '魔法攻撃力。バトル開始時に基本値として10が加算されます。',
  MDEF: '魔法防御力。相手の魔法ダメージを「MDEF * 3 / 4」分だけ軽減します。',
  SPD: '素早さ。高い方が先に攻撃でき、回避率にも影響します。',
  HIT: '命中率。高いほど攻撃が当たりやすくなります。',
  CRT: 'クリティカルヒット率。高いほどクリティカルヒットが出やすくなります。',
  CDMG: 'クリティカルダメージ。クリティカル時のダメージ倍率を上げます。',
  AVD: '回避率。高いほど攻撃を避けやすくなります。バトル開始時に基本値として10が加算されます。',
  LUK: '運。不運を幸運に変える力。(LUK/5)%の確率で、攻撃ミス時の命中再抽選、被弾時の回避再抽選、ダメージ乱数下振れの最大化、アイテム不発時の再抽選、ターン開始時の全状態異常解除が発生します。',
  ITEM: '装備アイテム。アイテムごとに設定されたポイントを消費して1つだけ装備できます。'
};

const ITEMS = {
  なし: { name: 'なし', description: 'アイテムを装備しません。', cost: 0 },
  毒針: { name: '毒針', description: '攻撃ヒット時、20%で相手を7ターンの毒状態にする。(毒: 毎ターン最大HPの2%ダメージ)', cost: 55},
  帯電スーツ: { name: '帯電スーツ', description: '被弾時、相手を2ターンの麻痺状態にする。(麻痺: 25%で行動不能、AVDが50%低下)', cost: 65},
  逆境のバンダナ: { name: '逆境のバンダナ', description: 'HPが1/3以下の時、HPを除く全ステータスが15上昇する。また、一度だけHPが0になるダメージを受けた際に50%の確率でHPが最大HPの1/3で耐える。', cost: 80},
  コンボナックル: { name: 'コンボナックル', description: '攻撃ヒット毎にCRT+10%、CDMG+15%。(ミスでリセット、クリティカル時は25%でリセット)', cost: 50},
  鉄斧ブレイキング: { name: '鉄斧ブレイキング', description: '相手の防御・魔法防御を半減してダメージ計算する。15%で「ブレイク」し、防御を貫通する。', cost: 60},
  とげ: { name: 'とげ', description: '受けたダメージの30%を相手に返す。(最低1)', cost: 40 },
  脆い盾: { name: '脆い盾', description: '最初の1回だけダメージを無効化する。壊れても3〜5ターンで修復される。', cost: 55 },
  吸血機: { name: '吸血機', description: '与えたダメージの35%分HPを回復する。', cost: 50 },
  ギャンブラーダイス: { name: 'ギャンブラーダイス', description: 'ダメージの振れ幅が大きくなる。(0~3.0倍)', cost: 30 },
  ちくりんちょ: { name: 'ちくりんちょ', description: '攻撃のヒット・ミスに関わらず、1~5のランダムダメージ。その後90%の確率で追撃が連続発生する。', cost: 40 },
  鎧: { name: '鎧', description: '防御計算が非常に有利になり(DEF*1.2)、さらに受ける全てのダメージを10%軽減する。', cost: 50 },
  エネルギータンク: { name: 'エネルギータンク', description: '2ターンに1回、2倍の威力で攻撃する。麻痺状態でも高威力攻撃は確定で行えるが、そのためのチャージは麻痺で失敗することがある。', cost: 60 },
  カウンターの極意書: { name: 'カウンターの極意書', description: 'AVDが1.2倍になる。さらに相手の攻撃ミス時、50%で半分の威力で反撃。この反撃は30%の確率で相手の防御を無視する。', cost: 45 },
  悪魔の契約: { name: '悪魔の契約', description: 'バトル開始時、ランダムなステータス4つが1/6になるが、ポイント上限が666増加する。', cost: 0 },
  境鏡: { name: '境鏡', description: '試合開始時、相手と同じアイテムの効果になる。相手もこのアイテムだった場合、それぞれがランダムなアイテムの効果になる。', cost: 45 },
  ヒールオーブ: { name: 'ヒールオーブ', description: '自分のターン終了時、状態異常（毒、麻痺、混乱）でない場合のみ、最大HPの1~7%をランダムで回復する。', cost: 50 },
  反転軸: { name: '反転軸', description: 'HPが半分以下の時、ATKとDEF、MATKとMDEFのステータスがそれぞれ入れ替わる。', cost: 50 },
  変転術: { name: '変転術', description: 'バトル開始時に相手のアイテムをランダムなものに変更する。', cost: 40 },
  ロウレッテ: { name: 'ロウレッテ', description: '毎ターン25％の確率で自分の攻撃に、攻撃の威力2倍、防御貫通、3ターンの毒付与、3ターンの麻痺付与、3ターンの混乱付与、与えたダメージ分体力回復、確定命中のいずれかの効果がランダムに付く。', cost: 60 },
  粘着スライム: { name: '粘着スライム', description: 'バトル開始時に相手のHP以外のステータスをどれかランダムで1つ0にする。', cost: 65 },
  爆弾: { name: '爆弾', description: '自分が攻撃する度に5%の確率で爆発する（自分の最大HPの20%の防御無視ダメージを自分か相手のどちらかに与える）', cost: 45 },
  正義の一閃: { name: '正義の一閃', description: 'クリティカル率上限が10になるが、クリティカル倍率が4.5倍になり、クリティカル時に最大HPの10%を回復。', cost: 50 },
  猫ちゃん装備: { name: '猫ちゃん装備', description: '相手が手加減する（相手から受けるダメージ-20%）', cost: 55 },
  祝いの剣: { name: '祝いの剣', description: '最低保証ダメージが25になるが、命中率が10%下がる。', cost: 25 },
  スレッジハンマー: { name: 'スレッジハンマー', description: 'HITとSPDが15%下がるが、クリティカル時50%で相手を1〜5ターンの混乱にする。(混乱: 30%で自分を攻撃)', cost: 50 },
  エネルギー変換装置: { name: 'エネルギー変換装置', description: '相手の攻撃命中時15％でダメージを回復に変える。この効果は最大体力を突破して回復できる。', cost: 40 },
  ダメージバースト: { name: 'ダメージバースト', description: '相手への与ダメージが5分の1になるが、1ターンに5回攻撃できる。この際乱数やクリティカル、ミスはそれぞれ判定される。', cost: 35 },
  奇跡のお守り: { name: '奇跡のお守り', description: 'ダメージ乱数補正の際×1.0~×1.2になる。', cost: 10 },
  四葉のクローバー: { name: '四葉のクローバー', description: 'よかったね()', cost: 5 },
  スコープ: { name: 'スコープ', description: '攻撃が必中になるが、クリティカルが発生しなくなる。与えるダメージが(ATKまたはMATK)のCDMG%分になる(CDMG上限100)。', cost: 55 },
  素晴らしい盾: { name: '素晴らしい盾', description: '最大被ダメージが最大HPの30％になる。', cost: 60 },
  魂削りの大鎌: { name: '魂削りの大鎌', description: '真紅の一振り(HP〇〇消費、威力〇〇倍)。攻撃時、残りのHPの20％を消費し、攻撃力を(消費したHP÷20)倍する(最小1倍)。クリティカル時、魂を奪い取る！〇〇回復！(HPを最大HPの20%回復する)。CRT上限を15にする。', cost: 70 },
  全て無に返そう: { name: '全て無に返そう', description: '相手のアイテム効果を無効化する。', cost: 50 },
};
type ItemName = keyof typeof ITEMS;

const FIELD_EFFECTS = {
    NONE: { name: 'なし', description: '特別な効果はありません。' },
    GRASSLAND: { name: '風吹く草原', description: 'SPDとAVDが15％増加します。' },
    WASTELAND: { name: '灼熱の荒野', description: '毎ターンに最大HPの5％のダメージを受けます。' },
    MISTY_LAKE: { name: '霧の湖', description: 'HIT(命中率)が半分になります。' },
    MAGIC_LIBRARY: { name: '魔法図書館', description: 'MATK(魔法攻撃力)が1.5倍になります。' },
    ETERNAL_NIGHT: { name: '永遠の闇夜', description: 'アイテムが使用不可(装備不可)になります。' },
    SNOWY_MOUNTAIN: { name: '極寒の雪山', description: 'DEF(物理防御)とMDEF(魔法防御)が半分になります。' },
    ARENA: { name: '闘技場', description: 'ATK(物理攻撃力)が1.5倍になります。' },
    SANCTUARY: { name: '加護の地', description: '毎ターン最大HPの5％が回復します。' },
    RAINFOREST: { name: '熱帯雨林', description: '攻撃時、20％の確率でツタが絡まり行動できません。' },
    LIMESTONE_CAVE: { name: '鍾乳洞', description: '毎ターン25％の確率で、鍾乳石が落下し防御貫通50ダメージを受けます。' },
};
type FieldEffectKey = keyof typeof FIELD_EFFECTS;


const initialStats = {
  NAME: '',
  HP: 0,
  ATK: 0,
  DEF: 0,
  MATK: 0,
  MDEF: 0,
  SPD: 0,
  HIT: 0,
  CRT: 0,
  CDMG: 0,
  AVD: 0,
  LUK: 0,
  item: 'なし' as ItemName,
};

type Stats = typeof initialStats;
type AttackPattern = { 
    physical: number, 
    magical: number,
    physicalAttackName: string,
    magicalAttackName: string,
};

interface CharacterCreationScreenProps {
  player: string;
  onConfirm: (stats: Stats) => void;
  initialData?: Stats | null;
  maxPoints: number;
  isAllInMode: boolean;
  fieldEffect: FieldEffectKey;
}

const CharacterCreationScreen: React.FC<CharacterCreationScreenProps> = ({ player, onConfirm, initialData, maxPoints, isAllInMode, fieldEffect }) => {
  const [stats, setStats] = useState<Stats>(initialData || initialStats);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  useEffect(() => {
    if (fieldEffect === 'ETERNAL_NIGHT' && stats.item !== 'なし') {
        setStats(prev => ({ ...prev, item: 'なし' }));
    }
  }, [fieldEffect, stats.item]);

  useEffect(() => {
    const pressedKeys = new Set<string>();

    const handleKeyDown = (event: KeyboardEvent) => {
        pressedKeys.add(event.key.toLowerCase());

        if (pressedKeys.has('d') && pressedKeys.has('b')) {
            setStats({
                NAME: 'デバッグ',
                HP: 300,
                ATK: 50,
                MATK: 50,
                DEF: 40,
                MDEF: 40,
                SPD: 0,
                HIT: 50,
                AVD: 50,
                CRT: 30,
                CDMG: 0,
                LUK: 0,
                item: fieldEffect === 'ETERNAL_NIGHT' ? 'なし' : 'なし',
            });
        }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
        pressedKeys.delete(event.key.toLowerCase());
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
    };
  }, [fieldEffect]);
  
  const currentMaxPoints = stats.item === '悪魔の契約' ? maxPoints + 666 : maxPoints;

  const totalPoints = useMemo(() => {
    const statsSum = STAT_FIELDS.reduce((sum, key) => sum + (stats[key] || 0), 0);
    const itemCost = ITEMS[stats.item]?.cost || 0;
    return statsSum + itemCost;
  }, [stats]);

  const pointsOver = totalPoints - currentMaxPoints;
  const isOverLimit = pointsOver > 0;
  const isNameTooLong = stats.NAME.length > MAX_NAME_LENGTH;

  const nonZeroStatsCount = STAT_FIELDS.filter(key => (stats[key] || 0) > 0).length;
  const isAllInViolation = isAllInMode && nonZeroStatsCount > 1;

  const handleStatChange = (statName: keyof Stats, value: string | number) => {
    setStats(prevStats => {
      const isNameField = statName === 'NAME';
      const isItemField = statName === 'item';
      let finalValue: string | number;

      if (isNameField || isItemField) {
        finalValue = String(value);
      } else {
        let numericValue = Math.max(0, Number(value) || 0);
        if (statName === 'SPD' || statName === 'AVD') {
          numericValue = Math.min(numericValue, 200);
        }
        finalValue = numericValue;
      }
      
      const newStats = {
        ...prevStats,
        [statName]: finalValue,
      };

      if (newStats.item === '正義の一閃' && newStats.CRT > 10) {
        newStats.CRT = 10;
      }
      if (newStats.item === '魂削りの大鎌' && newStats.CRT > 15) {
        newStats.CRT = 15;
      }
      if (newStats.item === 'スコープ' && newStats.CDMG > 100) {
        newStats.CDMG = 100;
      }
      
      return newStats;
    });
  };

  const handleRandomStats = () => {
      let randomItem: ItemName = 'なし';
      
      if (fieldEffect !== 'ETERNAL_NIGHT') {
          const itemKeys = Object.keys(ITEMS) as ItemName[];
          randomItem = itemKeys[Math.floor(Math.random() * itemKeys.length)];
      }

      const itemCost = ITEMS[randomItem].cost;
      let pointsToDistribute = maxPoints - itemCost;

      if (randomItem === '悪魔の契約') {
          pointsToDistribute += 666;
      }

      const newStats: Stats = {
          NAME: stats.NAME || `Player${Math.floor(Math.random() * 1000)}`,
          HP: 0, ATK: 0, MATK: 0, DEF: 0, MDEF: 0,
          SPD: 0, HIT: 0, CRT: 0, CDMG: 0, AVD: 0, LUK: 0,
          item: randomItem
      };

      if (isAllInMode) {
           const targetStat = STAT_FIELDS[Math.floor(Math.random() * STAT_FIELDS.length)];
           let amount = pointsToDistribute;

           if (targetStat === 'SPD' || targetStat === 'AVD') amount = Math.min(amount, 200);
           if (targetStat === 'CRT' && randomItem === '正義の一閃') amount = Math.min(amount, 10);
           if (targetStat === 'CRT' && randomItem === '魂削りの大鎌') amount = Math.min(amount, 15);
           if (targetStat === 'CDMG' && randomItem === 'スコープ') amount = Math.min(amount, 100);

           newStats[targetStat] = amount;
      } else {
          let safetyCounter = 0;
          while (pointsToDistribute > 0 && safetyCounter < 1000) {
              safetyCounter++;
              const stat = STAT_FIELDS[Math.floor(Math.random() * STAT_FIELDS.length)];

              let cap = Infinity;
              if (stat === 'SPD' || stat === 'AVD') cap = 200;
              if (stat === 'CRT' && randomItem === '正義の一閃') cap = 10;
              if (stat === 'CRT' && randomItem === '魂削りの大鎌') cap = 15;
              if (stat === 'CDMG' && randomItem === 'スコープ') cap = 100;

              const currentVal = newStats[stat] as number;
              if (currentVal >= cap) continue;

              const add = Math.ceil(Math.random() * Math.min(50, pointsToDistribute));
              const actualAdd = Math.min(add, cap - currentVal);

              newStats[stat] = currentVal + actualAdd;
              pointsToDistribute -= actualAdd;
          }
      }

      setStats(newStats);
  };
  
  const handleLabelClick = (stat: string, e: React.MouseEvent) => {
    e.preventDefault();
    setActiveTooltip(prev => (prev === stat ? null : stat));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOverLimit && stats.NAME.trim() !== '' && !isNameTooLong && !isAllInViolation) {
      onConfirm(stats);
    }
  };

  const getStatMax = (stat: string) => {
      if (stat === 'SPD' || stat === 'AVD') return '200';
      if (stat === 'CRT') {
          if (stats.item === '正義の一閃') return '10';
          if (stats.item === '魂削りの大鎌') return '15';
      }
      if (stat === 'CDMG' && stats.item === 'スコープ') return '100';
      return undefined;
  };

  return (
    <div>
      <div 
        style={{
            backgroundColor: '#e6f7ff', 
            border: '1px solid #1890ff', 
            borderRadius: '6px', 
            padding: '0.5rem', 
            marginBottom: '1rem',
            textAlign: 'center',
            cursor: 'pointer',
            position: 'relative'
        }}
        onClick={(e) => handleLabelClick('FIELD', e)}
      >
        <span style={{fontWeight: 'bold', color: '#0050b3'}}>今回のフィールド効果: {FIELD_EFFECTS[fieldEffect].name}</span>
        {activeTooltip === 'FIELD' && (
             <span className="tooltip" style={{top: '110%', bottom: 'auto'}}>{FIELD_EFFECTS[fieldEffect].description}</span>
        )}
      </div>

      <h2>{player}のステータス設定 {isAllInMode && <span style={{fontSize: '0.8em', color: 'red'}}>(全振りモード)</span>}</h2>
      <p className="stat-screen-description">
        各アルファベットをタップしてそのステータスが何を表しているか調べることができます。
      </p>
      <form onSubmit={handleSubmit}>
        <div className="stat-grid">
          <label
            htmlFor="name"
            className="name-label stat-label-interactive"
            onMouseDown={(e) => handleLabelClick('NAME', e)}
          >
            NAME
            {activeTooltip === 'NAME' && (
              <span className="tooltip">{STAT_DESCRIPTIONS['NAME']}</span>
            )}
          </label>
          <div className="name-input">
            <input
              id="name"
              type="text"
              value={stats.NAME}
              onChange={(e) => handleStatChange('NAME', e.target.value)}
              autoComplete="off"
              required
            />
            {isNameTooLong && (
              <div className="error-message" style={{ marginTop: '0.25rem', fontSize: '0.9rem', textAlign: 'left' }}>
                貴方の<br />考えた名前は<br />長すぎる。
              </div>
            )}
          </div>
          {STAT_FIELDS.map(stat => (
            <React.Fragment key={stat}>
              <label
                htmlFor={stat}
                className="stat-label-interactive"
                onMouseDown={(e) => handleLabelClick(stat, e)}
              >
                {stat}
                {activeTooltip === stat && (
                    <span className="tooltip">{STAT_DESCRIPTIONS[stat]}</span>
                )}
              </label>
              <input
                id={stat}
                type="number"
                min="0"
                max={getStatMax(stat)}
                value={stats[stat]}
                onChange={(e) => handleStatChange(stat, e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </React.Fragment>
          ))}
        </div>

        <div className="item-selector-container">
            <label 
                htmlFor="item-select"
                className="stat-label-interactive"
                onMouseDown={(e) => handleLabelClick('ITEM', e)}
            >
                アイテム
                 {activeTooltip === 'ITEM' && (
                    <span className="tooltip">{STAT_DESCRIPTIONS['ITEM']}</span>
                )}
            </label>
            <select 
                id="item-select" 
                value={stats.item} 
                onChange={(e) => handleStatChange('item', e.target.value as ItemName)}
                disabled={fieldEffect === 'ETERNAL_NIGHT'}
            >
                {Object.keys(ITEMS).map(itemName => (
                    <option key={itemName} value={itemName}>
                        {ITEMS[itemName as ItemName].name} ({ITEMS[itemName as ItemName].cost}pt)
                    </option>
                ))}
            </select>
            <p className="item-description">{ITEMS[stats.item].description}</p>
            {fieldEffect === 'ETERNAL_NIGHT' && (
                <p style={{color: 'red', fontSize: '0.9rem', marginTop: '0.2rem', gridColumn: '1 / 3'}}>※永遠の闇夜のため、アイテムは装備できません。</p>
            )}
        </div>


        <div className="total-points">
          合計ポイント: <span style={{ color: isOverLimit ? 'var(--error-color)' : 'inherit' }}>{totalPoints}</span> / {currentMaxPoints}
        </div>
        
        {isOverLimit && (
          <div className="error-message">
            {pointsOver} ポイントオーバーしています！
          </div>
        )}
        
        {isAllInViolation && (
          <div className="error-message">
            全振りモード有効：1つのステータスにしかポイントを振れません！
          </div>
        )}

        <button type="button" className="random-button" onClick={handleRandomStats}>
          ランダム振り分け
        </button>

        <button type="submit" className="confirm-button" disabled={isOverLimit || stats.NAME.trim() === '' || isNameTooLong || isAllInViolation}>
          決定
        </button>
      </form>
    </div>
  );
};

interface AttackPatternScreenProps {
    player: string;
    onConfirm: (pattern: AttackPattern) => void;
    initialData?: AttackPattern | null;
    onBack: () => void;
}

const AttackPatternScreen: React.FC<AttackPatternScreenProps> = ({ player, onConfirm, initialData, onBack }) => {
    const [physical, setPhysical] = useState(initialData?.physical ?? 50);
    const [physicalAttackName, setPhysicalAttackName] = useState(initialData?.physicalAttackName ?? '物理攻撃');
    const [magicalAttackName, setMagicalAttackName] = useState(initialData?.magicalAttackName ?? '魔法攻撃');
    const magical = 100 - physical;

    const isPhysicalNameTooLong = physicalAttackName.length > MAX_NAME_LENGTH;
    const isMagicalNameTooLong = magicalAttackName.length > MAX_NAME_LENGTH;
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (physicalAttackName.trim() && magicalAttackName.trim() && !isPhysicalNameTooLong && !isMagicalNameTooLong) {
            onConfirm({ physical, magical, physicalAttackName, magicalAttackName });
        }
    }
    
    const isNameInvalid = !physicalAttackName.trim() || !magicalAttackName.trim() || isPhysicalNameTooLong || isMagicalNameTooLong;

    return (
        <div className="attack-pattern-screen-container">
            <h2>{player}の攻撃パターン設定</h2>
            <form onSubmit={handleSubmit}>
                <div className="attack-name-grid">
                    <label htmlFor="physical-attack-name">物理技名</label>
                    <div>
                        <input 
                            id="physical-attack-name"
                            type="text"
                            value={physicalAttackName}
                            onChange={(e) => setPhysicalAttackName(e.target.value)}
                            autoComplete="off"
                            required
                        />
                        {isPhysicalNameTooLong && (
                            <div className="error-message" style={{ marginTop: '0.25rem', fontSize: '0.9rem', textAlign: 'left' }}>
                                貴方の<br />考えた名前は<br />長すぎる。
                            </div>
                        )}
                    </div>
                    <label htmlFor="magical-attack-name">魔法技名</label>
                    <div>
                        <input 
                            id="magical-attack-name"
                            type="text"
                            value={magicalAttackName}
                            onChange={(e) => setMagicalAttackName(e.target.value)}
                            autoComplete="off"
                            required
                        />
                        {isMagicalNameTooLong && (
                            <div className="error-message" style={{ marginTop: '0.25rem', fontSize: '0.9rem', textAlign: 'left' }}>
                                貴方の<br />考えた名前は<br />長すぎる。
                            </div>
                        )}
                    </div>
                </div>
                <div className="attack-pattern-display">
                    <span>物理: {physical}%</span>
                    <span>魔法: {magical}%</span>
                </div>
                <input 
                    type="range" 
                    min={MIN_ATTACK_PERCENT} 
                    max={100 - MIN_ATTACK_PERCENT} 
                    value={physical}
                    onChange={(e) => setPhysical(Number(e.target.value))}
                />
                <button type="submit" className="confirm-button" disabled={isNameInvalid}>決定</button>
            </form>
            <button type="button" className="back-button" onClick={onBack}>ステータス設定に戻る</button>
        </div>
    );
};

interface LogEntry {
  id: number;
  message: React.ReactNode;
  details?: React.ReactNode;
}

interface BattleScreenProps {
  player1: Stats & { attackPattern: AttackPattern };
  player2: Stats & { attackPattern: AttackPattern };
  onReset: () => void;
  maxPoints: number;
  fieldEffect: FieldEffectKey;
}

type BattleStats = Stats & { attackPattern: AttackPattern };

const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;


const BattleScreen: React.FC<BattleScreenProps> = ({ player1, player2, onReset, maxPoints, fieldEffect }) => {
    const itemEffectDetails = useMemo(() => {
        let p1Item = player1.item;
        let p2Item = player2.item;
        
        // Field Effect Override
        if (fieldEffect === 'ETERNAL_NIGHT') {
            p1Item = 'なし';
            p2Item = 'なし';
        }

        let p1MirrorLog: React.ReactNode = null;
        let p2MirrorLog: React.ReactNode = null;
        let bothMirrorLog: React.ReactNode = null;
        let bothVoidLog: React.ReactNode = null;
        let bothScopeLog: React.ReactNode = null;
        let isVoidUpdateActive = false;

        if (p1Item === '全て無に返そう' && p2Item === '全て無に返そう') {
            isVoidUpdateActive = true;
            bothVoidLog = <span style={{color: 'darkred', fontWeight: 'bold'}}>虚無更新！全てが無に返され再構築された！（互いのステータスがランダムに振り直されました）</span>;
        } else if (p1Item === 'スコープ' && p2Item === 'スコープ') {
            bothScopeLog = <span style={{color: 'teal', fontWeight: 'bold'}}>「こちらがあちらを覗いている時、あちらもまた…」（スコープの効果が無効化されました）</span>;
            p1Item = 'なし';
            p2Item = 'なし';
        } else {
            if (p1Item === '全て無に返そう') p2Item = 'なし';
            if (p2Item === '全て無に返そう') p1Item = 'なし';
        }

        const preTransmuteP1 = p1Item;
        const preTransmuteP2 = p2Item;
        
        const randomizableItems = Object.keys(ITEMS).filter(name => 
            name !== 'なし' && name !== '境鏡' && name !== '変転術' && name !== '全て無に返そう'
        ) as ItemName[];
        const getRandomItem = () => randomizableItems[Math.floor(Math.random() * randomizableItems.length)];

        if (preTransmuteP1 === '変転術') p2Item = getRandomItem();
        if (preTransmuteP2 === '変転術') p1Item = getRandomItem();

        let p1Name = ITEMS[p1Item].name;
        let p2Name = ITEMS[p2Item].name;

        if (p1Item === '境鏡' && p2Item === '境鏡') {
            const p1New = getRandomItem();
            const p2New = getRandomItem();
            p1Item = p1New;
            p2Item = p2New;
            p1Name = `境鏡(${ITEMS[p1Item].name})`;
            p2Name = `境鏡(${ITEMS[p2Item].name})`;
            bothMirrorLog = <span style={{color: 'purple', fontWeight: 'bold'}}>特殊効果、合わせ鏡！それぞれがランダムなアイテムを写し出した！</span>;
            p1MirrorLog = <span style={{color: 'purple'}}>-&gt; {player1.NAME}の境鏡は{ITEMS[p1Item].name}になった！</span>;
            p2MirrorLog = <span style={{color: 'purple'}}>-&gt; {player2.NAME}の境鏡は{ITEMS[p2Item].name}になった！</span>;
        } else if (p1Item === '境鏡') {
            p1Item = p2Item;
            p1Name = `境鏡(${ITEMS[p1Item].name})`;
            p1MirrorLog = <span style={{color: 'purple', fontWeight: 'bold'}}>{player1.NAME}の境鏡が{ITEMS[p1Item].name}を写し出した！</span>;
        } else if (p2Item === '境鏡') {
            p2Item = p1Item;
            p2Name = `境鏡(${ITEMS[p1Item].name})`;
            p2MirrorLog = <span style={{color: 'purple', fontWeight: 'bold'}}>{player2.NAME}の境鏡が{ITEMS[p1Item].name}を写し出した！</span>;
        }

        return { 
            effectiveP1Item: p1Item, 
            effectiveP2Item: p2Item, 
            p1ItemName: p1Name, 
            p2ItemName: p2Name,
            p1MirrorLog,
            p2MirrorLog,
            bothMirrorLog,
            isVoidUpdateActive,
            bothVoidLog,
            bothScopeLog,
        };
    }, [player1.item, player2.item, player1.NAME, player2.NAME, fieldEffect]);

    const { effectiveP1Item, effectiveP2Item, p1ItemName, p2ItemName } = itemEffectDetails;
    const isCatBattle = useMemo(() => effectiveP1Item === '猫ちゃん装備' && effectiveP2Item === '猫ちゃん装備', [effectiveP1Item, effectiveP2Item]);
    
    const battleModifications = useMemo(() => {
        const { isVoidUpdateActive } = itemEffectDetails;
        let p1 = { ...player1 };
        let p2 = { ...player2 };
        
        if (isVoidUpdateActive) {
            const randomizeStats = (player: BattleStats): BattleStats => {
                let pointsToDistribute = maxPoints;
                const newStats: any = {
                    ...player,
                    HP: 0, ATK: 0, MATK: 0, DEF: 0, MDEF: 0,
                    SPD: 0, HIT: 0, CRT: 0, CDMG: 0, AVD: 0, LUK: 0,
                };
                let safetyCounter = 0;
                while (pointsToDistribute > 0 && safetyCounter < 1000) {
                    safetyCounter++;
                    const stat = STAT_FIELDS[Math.floor(Math.random() * STAT_FIELDS.length)];
                    let cap = Infinity;
                    if (stat === 'SPD' || stat === 'AVD') cap = 200;
                    
                    const currentVal = newStats[stat] as number;
                    if (currentVal >= cap) continue;

                    const add = Math.ceil(Math.random() * Math.min(50, pointsToDistribute));
                    const actualAdd = Math.min(add, cap - currentVal);

                    newStats[stat] = currentVal + actualAdd;
                    pointsToDistribute -= actualAdd;
                }
                return newStats as BattleStats;
            };
            p1 = randomizeStats(p1);
            p2 = randomizeStats(p2);
        }

        let p1NerfedStats = null;
        let p2NerfedStats = null;
        let wasP1HardNerfed = false;
        let wasP2HardNerfed = false;
        let p1SlimeTarget: (typeof STAT_FIELDS)[number] | null = null;
        let p2SlimeTarget: (typeof STAT_FIELDS)[number] | null = null;
        
        if (effectiveP2Item === '粘着スライム') {
            const statsToTarget = STAT_FIELDS.filter(s => s !== 'HP');
            const target = statsToTarget[Math.floor(Math.random() * statsToTarget.length)];
            p1SlimeTarget = target;
            p1[target] = 0;
        }
        if (effectiveP1Item === '粘着スライム') {
            const statsToTarget = STAT_FIELDS.filter(s => s !== 'HP');
            const target = statsToTarget[Math.floor(Math.random() * statsToTarget.length)];
            p2SlimeTarget = target;
            p2[target] = 0;
        }

        if (player1.item === '悪魔の契約' && effectiveP2Item === '全て無に返そう') {
            wasP1HardNerfed = true;
            const newP1 = { ...p1 };
            STAT_FIELDS.forEach(key => {
                newP1[key] = Math.max(0, Math.floor((p1[key] || 0) / 6));
            });
            p1 = newP1;
        }
        if (player2.item === '悪魔の契約' && effectiveP1Item === '全て無に返そう') {
            wasP2HardNerfed = true;
            const newP2 = { ...p2 };
            STAT_FIELDS.forEach(key => {
                newP2[key] = Math.max(0, Math.floor((p2[key] || 0) / 6));
            });
            p2 = newP2;
        }

        if (player1.item === '悪魔の契約' && !wasP1HardNerfed) {
            const newP1 = { ...p1 };
            const shuffled = [...STAT_FIELDS].sort(() => 0.5 - Math.random());
            const statsToNerf = shuffled.slice(0, 4);
            p1NerfedStats = statsToNerf;
            statsToNerf.forEach(key => {
                newP1[key] = Math.max(0, Math.floor((p1[key] || 0) / 6));
            });
            p1 = newP1;
        }
        if (player2.item === '悪魔の契約' && !wasP2HardNerfed) {
            const newP2 = { ...p2 };
            const shuffled = [...STAT_FIELDS].sort(() => 0.5 - Math.random());
            const statsToNerf = shuffled.slice(0, 4);
            p2NerfedStats = statsToNerf;
            statsToNerf.forEach(key => {
                newP2[key] = Math.max(0, Math.floor((p2[key] || 0) / 6));
            });
            p2 = newP2;
        }
        
        p1.HP += 200;
        p1.ATK += 10;
        p1.MATK += 10;
        p1.AVD += 10;
        
        p2.HP += 200;
        p2.ATK += 10;
        p2.MATK += 10;
        p2.AVD += 10;
        
        // Field Effects Stat Mods
        if (fieldEffect === 'GRASSLAND') {
            p1.SPD = Math.floor(p1.SPD * 1.15);
            p1.AVD = Math.floor(p1.AVD * 1.15);
            p2.SPD = Math.floor(p2.SPD * 1.15);
            p2.AVD = Math.floor(p2.AVD * 1.15);
        } else if (fieldEffect === 'MISTY_LAKE') {
            p1.HIT = Math.floor(p1.HIT * 0.5);
            p2.HIT = Math.floor(p2.HIT * 0.5);
        } else if (fieldEffect === 'MAGIC_LIBRARY') {
            p1.MATK = Math.floor(p1.MATK * 1.5);
            p2.MATK = Math.floor(p2.MATK * 1.5);
        } else if (fieldEffect === 'SNOWY_MOUNTAIN') {
            p1.DEF = Math.floor(p1.DEF * 0.5);
            p1.MDEF = Math.floor(p1.MDEF * 0.5);
            p2.DEF = Math.floor(p2.DEF * 0.5);
            p2.MDEF = Math.floor(p2.MDEF * 0.5);
        } else if (fieldEffect === 'ARENA') {
            p1.ATK = Math.floor(p1.ATK * 1.5);
            p2.ATK = Math.floor(p2.ATK * 1.5);
        }


        if (effectiveP1Item === 'スレッジハンマー') {
            p1.HIT = Math.floor(p1.HIT * 0.85);
            p1.SPD = Math.floor(p1.SPD * 0.85);
        }
        if (effectiveP2Item === 'スレッジハンマー') {
            p2.HIT = Math.floor(p2.HIT * 0.85);
            p2.SPD = Math.floor(p2.SPD * 0.85);
        }

        let p1HpBonusPercent = 0;
        if (p1.HP > 500) {
            const excessHp = p1.HP - 500;
            const increments = Math.floor(excessHp / 20);
            p1HpBonusPercent = Math.min(increments * 10, 100);
            if (p1HpBonusPercent > 0) {
                const bonusMultiplier = 1 + (p1HpBonusPercent / 100);
                p1.DEF = Math.floor(p1.DEF * bonusMultiplier);
                p1.MDEF = Math.floor(p1.MDEF * bonusMultiplier);
            }
        }
        let p2HpBonusPercent = 0;
        if (p2.HP > 500) {
            const excessHp = p2.HP - 500;
            const increments = Math.floor(excessHp / 20);
            p2HpBonusPercent = Math.min(increments * 10, 100);
            if (p2HpBonusPercent > 0) {
                const bonusMultiplier = 1 + (p2HpBonusPercent / 100);
                p2.DEF = Math.floor(p2.DEF * bonusMultiplier);
                p2.MDEF = Math.floor(p2.MDEF * bonusMultiplier);
            }
        }

        return { 
            modifiedPlayer1: p1, 
            modifiedPlayer2: p2, 
            p1NerfedStats, 
            p2NerfedStats,
            wasP1HardNerfed,
            wasP2HardNerfed,
            p1SlimeTarget,
            p2SlimeTarget,
            p1HpBonusPercent,
            p2HpBonusPercent
        };
    }, [player1, player2, effectiveP1Item, effectiveP2Item, itemEffectDetails, maxPoints, fieldEffect]);

    const { modifiedPlayer1, modifiedPlayer2 } = battleModifications;

    const [hp, setHp] = useState({ p1: modifiedPlayer1.HP, p2: modifiedPlayer2.HP });
    const [currentPlayer, setCurrentPlayer] = useState(modifiedPlayer1.SPD >= modifiedPlayer2.SPD ? 1 : 2);
    const [battleLog, setBattleLog] = useState<LogEntry[]>([{ id: 0, message: 'バトル開始！' }]);
    const [winner, setWinner] = useState<string | 'draw' | null>(null);
    const [isAutoBattle, setIsAutoBattle] = useState(false);
    const [statusEffects, setStatusEffects] = useState({ p1: { poison: 0, paralysis: 0, confusion: 0 }, p2: { poison: 0, paralysis: 0, confusion: 0 } });
    const [comboBonus, setComboBonus] = useState({ p1: 0, p2: 0 });
    const [comboCBonus, setComboCBonus] = useState({ p1: 0, p2: 0 });
    const logContainerRef = useRef<HTMLDivElement>(null);
    const logIdCounter = useRef(1);
    const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
    const [shields, setShields] = useState({ p1: false, p2: false });
    const [shieldCooldowns, setShieldCooldowns] = useState({ p1: 0, p2: 0 });
    const [isCharging, setIsCharging] = useState({ p1: false, p2: false });
    const [isMuted, setIsMuted] = useState(false);
    const [bandanaUsed, setBandanaUsed] = useState({ p1: false, p2: false });
    const isInitialMount = useRef(true);

    const checkFate = useCallback((luk: number) => {
        const chance = luk / 5;
        const roll = Math.random() * 100;
        return { success: roll < chance, roll, chance };
    }, []);

    const playSound = useCallback((type: 'attack' | 'critical' | 'status' | 'miss' | 'win' | 'lose' | 'heal' | 'item_activate') => {
        if (!audioContext || isMuted) return;

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        const now = audioContext.currentTime;

        switch (type) {
            case 'attack': { // A short, sharp noise burst for "バシッ"
                const bufferSize = audioContext.sampleRate * 0.1;
                const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const output = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = Math.random() * 2 - 1; // White noise
                }

                const noise = audioContext.createBufferSource();
                noise.buffer = buffer;

                const gainNode = audioContext.createGain();
                gainNode.gain.setValueAtTime(0.5, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

                noise.connect(gainNode);
                gainNode.connect(audioContext.destination);
                noise.start(now);
                noise.stop(now + 0.1);
                break;
            }
            case 'critical': { // A combination of noise and a sharp metallic sound for "ザシュッ"
                const bufferSize = audioContext.sampleRate * 0.15;
                const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const output = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = Math.random() * 2 - 1;
                }
                const noise = audioContext.createBufferSource();
                noise.buffer = buffer;
                const noiseGain = audioContext.createGain();
                noiseGain.gain.setValueAtTime(0.4, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                noise.connect(noiseGain);
                noiseGain.connect(audioContext.destination);
                noise.start(now);
                noise.stop(now + 0.15);

                const oscillator = audioContext.createOscillator();
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(1600, now);
                oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.12);
                const oscGain = audioContext.createGain();
                oscGain.gain.setValueAtTime(0.3, now);
                oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                oscillator.connect(oscGain);
                oscGain.connect(audioContext.destination);
                oscillator.start(now);
                oscillator.stop(now + 0.12);
                break;
            }
            case 'status': {
                const oscillator = audioContext.createOscillator();
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(400, now);
                
                const lfo = audioContext.createOscillator();
                lfo.type = 'sine';
                lfo.frequency.setValueAtTime(8, now);
                
                const lfoGain = audioContext.createGain();
                lfoGain.gain.setValueAtTime(15, now);
                
                lfo.connect(lfoGain);
                lfoGain.connect(oscillator.frequency);

                const gainNode = audioContext.createGain();
                gainNode.gain.setValueAtTime(0.3, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.start(now);
                lfo.start(now);
                oscillator.stop(now + 0.4);
                lfo.stop(now + 0.4);
                break;
            }
            case 'miss': { // A light "シュワッ" sound
                const bufferSize = audioContext.sampleRate * 0.15;
                const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const output = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = Math.random() * 2 - 1;
                }
                const noise = audioContext.createBufferSource();
                noise.buffer = buffer;

                const filter = audioContext.createBiquadFilter();
                filter.type = 'bandpass';
                filter.Q.value = 15;
                filter.frequency.setValueAtTime(4000, now);
                filter.frequency.exponentialRampToValueAtTime(800, now + 0.1);

                const gainNode = audioContext.createGain();
                gainNode.gain.setValueAtTime(0.3, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

                noise.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(audioContext.destination);
                noise.start(now);
                noise.stop(now + 0.15);
                break;
            }
            case 'win': {
                const oscillator = audioContext.createOscillator();
                oscillator.type = 'triangle';
                const gainNode = audioContext.createGain();
                gainNode.gain.value = 0.3;
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                const baseFreq = 523.25;
                oscillator.frequency.setValueAtTime(baseFreq, now);
                oscillator.frequency.setValueAtTime(baseFreq * 5/4, now + 0.1);
                oscillator.frequency.setValueAtTime(baseFreq * 3/2, now + 0.2);
                oscillator.frequency.setValueAtTime(baseFreq * 2, now + 0.3);
                gainNode.gain.setValueAtTime(0.3, now + 0.3);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                oscillator.start(now);
                oscillator.stop(now + 0.5);
                break;
            }
            case 'lose': {
                const oscillator = audioContext.createOscillator();
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(392.00, now);
                oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.8);
                const gainNode = audioContext.createGain();
                gainNode.gain.setValueAtTime(0.3, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.start(now);
                oscillator.stop(now + 0.8);
                break;
            }
            case 'heal': {
                const oscillator = audioContext.createOscillator();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(600, now);
                oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
                const gainNode = audioContext.createGain();
                gainNode.gain.setValueAtTime(0.4, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.start(now);
                oscillator.stop(now + 0.3);
                break;
            }
            case 'item_activate': { // "キラリーン" sound
                const osc1 = audioContext.createOscillator();
                const osc2 = audioContext.createOscillator();
                osc1.type = 'sine';
                osc2.type = 'triangle';

                const gainNode = audioContext.createGain();
                gainNode.gain.setValueAtTime(0.4, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

                const baseFreq = 2000;
                osc1.frequency.setValueAtTime(baseFreq, now);
                osc1.frequency.exponentialRampToValueAtTime(baseFreq / 2, now + 0.6);
                osc2.frequency.setValueAtTime(baseFreq * 1.5, now);
                osc2.frequency.exponentialRampToValueAtTime((baseFreq / 2) * 1.5, now + 0.6);

                osc1.connect(gainNode);
                osc2.connect(gainNode);
                gainNode.connect(audioContext.destination);

                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 0.7);
                osc2.stop(now + 0.7);
                break;
            }
        }
    }, [isMuted]);

    useEffect(() => {
        const initialLogs: LogEntry[] = [];
        let logId = 1;
        let itemActivated = false;
        
        if (fieldEffect !== 'NONE') {
             initialLogs.push({ id: logId++, message: <span style={{color: '#0050b3', fontWeight: 'bold'}}>フィールド効果: {FIELD_EFFECTS[fieldEffect].name} - {FIELD_EFFECTS[fieldEffect].description}</span> });
        }

        if (itemEffectDetails.bothVoidLog) {
            initialLogs.push({ id: logId++, message: itemEffectDetails.bothVoidLog });
            itemActivated = true;
        }
        if (itemEffectDetails.bothScopeLog) {
            initialLogs.push({ id: logId++, message: itemEffectDetails.bothScopeLog });
            itemActivated = true;
        }

        if (isCatBattle) {
            initialLogs.push({ id: logId++, message: <span style={{color: 'hotpink', fontWeight: 'bold'}}>特殊効果、にゃんにゃん対決！お互いの攻撃がネコパンチになり、威力が大幅に低下する！</span> });
            itemActivated = true;
        }

        if (itemEffectDetails.bothMirrorLog) {
            initialLogs.push({ id: logId++, message: itemEffectDetails.bothMirrorLog });
            itemActivated = true;
        }
        if (itemEffectDetails.p1MirrorLog) {
            initialLogs.push({ id: logId++, message: itemEffectDetails.p1MirrorLog });
            itemActivated = true;
        }
        if (itemEffectDetails.p2MirrorLog) {
            initialLogs.push({ id: logId++, message: itemEffectDetails.p2MirrorLog });
            itemActivated = true;
        }

        if (battleModifications.p1SlimeTarget) {
            initialLogs.push({ id: logId++, message: <span style={{color: 'green', fontWeight: 'bold'}}>{`${player2.NAME}の粘着スライムが${player1.NAME}の${battleModifications.p1SlimeTarget}を0にした！`}</span> });
            itemActivated = true;
        }
        if (battleModifications.p2SlimeTarget) {
            initialLogs.push({ id: logId++, message: <span style={{color: 'green', fontWeight: 'bold'}}>{`${player1.NAME}の粘着スライムが${player2.NAME}の${battleModifications.p2SlimeTarget}を0にした！`}</span> });
            itemActivated = true;
        }

        if (battleModifications.wasP1HardNerfed) {
            initialLogs.push({ id: logId++, message: <span style={{color: 'purple', fontWeight: 'bold'}}>{player2.NAME}は全てを無に返し、{player1.NAME}の悪魔の契約を破棄した！{player1.NAME}はその代償で全能力が6分の1に！</span> });
            itemActivated = true;
        }
        if (battleModifications.wasP2HardNerfed) {
            initialLogs.push({ id: logId++, message: <span style={{color: 'purple', fontWeight: 'bold'}}>{player1.NAME}は全てを無に返し、{player2.NAME}の悪魔の契約を破棄した！{player2.NAME}はその代償で全能力が6分の1に！</span> });
            itemActivated = true;
        }

        if (battleModifications.p1NerfedStats) {
            initialLogs.push({ id: logId++, message: <span style={{color: 'purple', fontWeight: 'bold'}}>{`悪魔の契約の代償として、${player1.NAME}の${battleModifications.p1NerfedStats.join('、')}が激減！`}</span> });
            itemActivated = true;
        }
        if (battleModifications.p2NerfedStats) {
             initialLogs.push({ id: logId++, message: <span style={{color: 'purple', fontWeight: 'bold'}}>{`悪魔の契約の代償として、${player2.NAME}の${battleModifications.p2NerfedStats.join('、')}が激減！`}</span> });
             itemActivated = true;
        }
        
        if (battleModifications.p1HpBonusPercent > 0) {
            initialLogs.push({ id: logId++, message: <span style={{color: '#007bff', fontWeight: 'bold'}}>{`${player1.NAME}は溢れる体力により、DEFとMDEFが${battleModifications.p1HpBonusPercent}%上昇！`}</span> });
            itemActivated = true;
        }
        if (battleModifications.p2HpBonusPercent > 0) {
            initialLogs.push({ id: logId++, message: <span style={{color: '#007bff', fontWeight: 'bold'}}>{`${player2.NAME}は溢れる体力により、DEFとMDEFが${battleModifications.p2HpBonusPercent}%上昇！`}</span> });
            itemActivated = true;
        }
        
        if (effectiveP1Item === 'スレッジハンマー') {
            initialLogs.push({ id: logId++, message: <span style={{color: '#555', fontWeight: 'bold'}}>{`${player1.NAME}はスレッジハンマーを装備しているため、HITとSPDが低下！`}</span> });
            itemActivated = true;
        }
        if (effectiveP2Item === 'スレッジハンマー') {
            initialLogs.push({ id: logId++, message: <span style={{color: '#555', fontWeight: 'bold'}}>{`${player2.NAME}はスレッジハンマーを装備しているため、HITとSPDが低下！`}</span> });
            itemActivated = true;
        }

        if (isInitialMount.current) {
            if (initialLogs.length > 0) {
                setBattleLog(prev => [...initialLogs, ...prev]);
                logIdCounter.current = logId;
            }
            
            if (itemActivated) {
                playSound('item_activate');
            }
            isInitialMount.current = false;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [battleModifications, player1.NAME, player2.NAME, itemEffectDetails, isCatBattle, playSound, fieldEffect]);

    useEffect(() => {
        setShields({ p1: effectiveP1Item === '脆い盾', p2: effectiveP2Item === '脆い盾' });
        setIsCharging({ p1: effectiveP1Item === 'エネルギータンク', p2: effectiveP2Item === 'エネルギータンク' });
    }, [effectiveP1Item, effectiveP2Item]);


    // FIX: Changed signature to use BattleStats to preserve attackPattern property.
    const getEffectiveStats = (basePlayer: BattleStats, currentHp: number, item: ItemName): BattleStats => {
        const effectiveStats = { ...basePlayer };
        if (item === '逆境のバンダナ' && currentHp > 0 && currentHp <= basePlayer.HP / 3) {
            for (const key of STAT_FIELDS) {
                if (key !== 'HP') {
                    effectiveStats[key] = (effectiveStats[key] || 0) + 15;
                }
            }
        }
        if (item === '反転軸' && currentHp > 0 && currentHp <= basePlayer.HP / 2) {
            const tempATK = effectiveStats.ATK;
            effectiveStats.ATK = effectiveStats.DEF;
            effectiveStats.DEF = tempATK;
            const tempMATK = effectiveStats.MATK;
            effectiveStats.MATK = effectiveStats.MDEF;
            effectiveStats.MDEF = tempMATK;
        }
        return effectiveStats;
    };
    
    const player1EffectiveStats = useMemo(() => getEffectiveStats(modifiedPlayer1, hp.p1, effectiveP1Item), [modifiedPlayer1, hp.p1, effectiveP1Item]);
    const player2EffectiveStats = useMemo(() => getEffectiveStats(modifiedPlayer2, hp.p2, effectiveP2Item), [modifiedPlayer2, hp.p2, effectiveP2Item]);


    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [battleLog]);

    useEffect(() => {
        if (winner) {
            if (winner === 'draw') {
                playSound('lose');
            } else {
                playSound('win');
            }
        }
    }, [winner, playSound]);
    
    useEffect(() => {
        if (winner) return;

        const p1Dead = hp.p1 <= 0;
        const p2Dead = hp.p2 <= 0;

        if (p1Dead && p2Dead) {
            setWinner('draw');
            setBattleLog(prev => [...prev, { id: logIdCounter.current++, message: '相打ち！引き分け！' }]);
        } else if (p2Dead) {
            setWinner(player1.NAME);
            setBattleLog(prev => [...prev, { id: logIdCounter.current++, message: `${player1.NAME}の勝利！` }]);
        } else if (p1Dead) {
            setWinner(player2.NAME);
            setBattleLog(prev => [...prev, { id: logIdCounter.current++, message: `${player2.NAME}の勝利！` }]);
        }
    }, [hp, winner, player1.NAME, player2.NAME]);

    const handleAttack = () => {
        if (winner) return;
    
        const attackerNum = currentPlayer;
        const defenderNum = (currentPlayer === 1) ? 2 : 1;
        
        const attacker = (attackerNum === 1) ? player1EffectiveStats : player2EffectiveStats;
        const defender = (defenderNum === 1) ? player1EffectiveStats : player2EffectiveStats;
        const attackerBase = (attackerNum === 1) ? modifiedPlayer1 : modifiedPlayer2;
        const defenderBase = (defenderNum === 1) ? modifiedPlayer1 : modifiedPlayer2;
    
        const attackerKey = attackerNum === 1 ? 'p1' : 'p2';
        const defenderKey = defenderNum === 1 ? 'p1' : 'p2';
    
        const attackerItem = (attackerNum === 1) ? effectiveP1Item : effectiveP2Item;
        const defenderItem = (defenderNum === 1) ? effectiveP1Item : effectiveP2Item;
    
        let newLog: LogEntry[] = [];
        const addLog = (message: React.ReactNode, details?: React.ReactNode) => {
            newLog.push({ id: logIdCounter.current++, message, details });
        };
        addLog(`${attacker.NAME}のターン！`);

        let finalHp = { ...hp };
        let newStatus = JSON.parse(JSON.stringify(statusEffects));
        let newCombo = { ...comboBonus };
        let newComboC = { ...comboCBonus };
        let newShields = { ...shields };
        let newShieldCooldowns = { ...shieldCooldowns };
        let newBandanaUsed = { ...bandanaUsed };

        // Turn Start Field Effects
        if (fieldEffect === 'WASTELAND') {
             const dmg = Math.max(1, Math.floor(attackerBase.HP * 0.05));
             
             let isConverted = false;
             if (attackerItem === 'エネルギー変換装置') {
                 let convertSuccess = Math.random() < 0.15;
                 if (!convertSuccess) {
                     const fate = checkFate(attacker.LUK);
                     if (fate.success) {
                          const fateDetails = (
                             <div>
                                 <p><u>運命介入判定</u></p>
                                 <p>成功率: {fate.chance.toFixed(2)}% (LUK {attacker.LUK})</p>
                                 <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                             </div>
                         );
                         addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！エネルギー変換判定再抽選！</span>, fateDetails);
                         convertSuccess = Math.random() < 0.15;
                     }
                 }
                 if (convertSuccess) isConverted = true;
             }
             
             if (isConverted) {
                 finalHp[attackerKey] += dmg;
                 addLog(<span style={{color: 'var(--success-color)', fontWeight: 'bold'}}>-&gt; 灼熱の荒野の熱エネルギーを変換！{dmg}回復！</span>);
                 playSound('heal');
             } else {
                 finalHp[attackerKey] -= dmg;
                 addLog(<span style={{color: 'red'}}>-&gt; 灼熱の荒野ダメージ！{dmg}のダメージを受けた！</span>);
                 if (finalHp[attackerKey] <= 0) {
                     setHp(finalHp);
                     setBattleLog(prev => [...prev, ...newLog]);
                     return; 
                 }
             }
        }
        if (fieldEffect === 'SANCTUARY') {
             const heal = Math.max(1, Math.floor(attackerBase.HP * 0.05));
             finalHp[attackerKey] = Math.min(attackerBase.HP, finalHp[attackerKey] + heal);
             addLog(<span style={{color: 'green'}}>-&gt; 加護の地！{heal}回復した！</span>);
             playSound('heal');
        }
        if (fieldEffect === 'LIMESTONE_CAVE') {
            if (Math.random() < 0.25) {
                let dmg = 50;
                
                if (attackerItem === '鎧') dmg = Math.floor(dmg * 0.9);
                if (attackerItem === '素晴らしい盾') {
                     const cap = Math.floor(attackerBase.HP * 0.3);
                     dmg = Math.min(dmg, cap);
                }

                let avoided = false;
                
                if (attackerItem === '猫ちゃん装備') {
                    if (Math.random() < 0.3) {
                         addLog(<span style={{color: 'hotpink', fontWeight: 'bold'}}>-&gt; 猫ちゃん装備で鍾乳石をひらりと回避！</span>);
                         avoided = true;
                    }
                }

                if (!avoided && attackerItem === '脆い盾' && newShields[attackerKey]) {
                     addLog(<span style={{ color: 'var(--info-color)', fontWeight: 'bold' }}>-&gt; 脆い盾が鍾乳石を防いだ！</span>);
                     newShields[attackerKey] = false;
                     newShieldCooldowns[attackerKey] = Math.floor(Math.random() * 3) + 3;
                     avoided = true;
                }

                if (!avoided) {
                    let isConverted = false;
                    if (attackerItem === 'エネルギー変換装置') {
                        let convertSuccess = Math.random() < 0.15;
                         if (!convertSuccess) {
                             const fate = checkFate(attacker.LUK);
                             if (fate.success) {
                                  const fateDetails = (
                                     <div>
                                         <p><u>運命介入判定</u></p>
                                         <p>成功率: {fate.chance.toFixed(2)}% (LUK {attacker.LUK})</p>
                                         <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                                     </div>
                                 );
                                 addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！エネルギー変換判定再抽選！</span>, fateDetails);
                                 convertSuccess = Math.random() < 0.15;
                             }
                         }
                         if (convertSuccess) isConverted = true;
                    }
                    
                    if (isConverted) {
                        finalHp[attackerKey] += dmg;
                        addLog(<span style={{color: 'var(--success-color)', fontWeight: 'bold'}}>-&gt; 落石エネルギーを変換！{dmg}回復！</span>);
                        playSound('heal');
                    } else {
                        finalHp[attackerKey] -= dmg;
                        addLog(<span style={{color: 'red', fontWeight: 'bold'}}>-&gt; 鍾乳石が落下！{dmg}の貫通ダメージ！</span>);
                        playSound('attack');
                        if (finalHp[attackerKey] <= 0) {
                             setHp(finalHp);
                             setBattleLog(prev => [...prev, ...newLog]);
                             return;
                        }
                    }
                }
            }
        }
        if (fieldEffect === 'RAINFOREST') {
            if (Math.random() < 0.20) {
                addLog(<span style={{color: 'orange', fontWeight: 'bold'}}>-&gt; ツタが絡まって動けない！行動不能！</span>);
                // Skip turn logic but handle end-of-turn processing if needed
                setHp(finalHp);
                setBattleLog(prev => [...prev, ...newLog]);
                setCurrentPlayer(defenderNum);
                return;
            }
        }


        // 運命力による状態異常回復チェック (ターン開始時)
        if (newStatus[attackerKey].poison > 0 || newStatus[attackerKey].paralysis > 0 || newStatus[attackerKey].confusion > 0) {
             const fate = checkFate(attacker.LUK);
             if (fate.success) {
                 const fateDetails = (
                     <div>
                         <p><u>運命介入判定</u></p>
                         <p>成功率: {fate.chance.toFixed(2)}% (LUK {attacker.LUK})</p>
                         <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                     </div>
                 );
                 newStatus[attackerKey] = { poison: 0, paralysis: 0, confusion: 0 };
                 addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！{attacker.NAME}の全ての状態異常が解除された！</span>, fateDetails);
                 playSound('heal');
             }
        }

        // ターン開始時にシールドのクールダウンを減らす
        if (newShieldCooldowns[attackerKey] > 0) {
            newShieldCooldowns[attackerKey] -= 1;
            if (newShieldCooldowns[attackerKey] === 0) {
                 newShields[attackerKey] = true;
                 addLog(<span style={{ color: 'var(--info-color)', fontWeight: 'bold' }}>-&gt; {attacker.NAME}の脆い盾が修復された！</span>);
            }
        }
    
        // ターン開始時の処理: 麻痺チェック
        if (newStatus[attackerKey].paralysis > 0) {
            const isEnergyTankAttackTurn = attackerItem === 'エネルギータンク' && !isCharging[attackerKey];
            // 2倍攻撃ターンでなければ麻痺判定
            if (!isEnergyTankAttackTurn) {
                const paralysisRoll = Math.random();
                if (paralysisRoll < 0.25) {
                    const paralysisDetails = (
                        <div>
                            <p><u>麻痺判定</u></p>
                            <p>麻痺による行動不能確率は<b>25%</b>です。</p>
                            <p>ダイスロール: <b>{paralysisRoll.toFixed(2)}</b> / 1.0</p>
                            <p>結果: {paralysisRoll.toFixed(2)} &lt; 0.25 のため、<b>行動不能</b>。</p>
                        </div>
                    );
                    const logMessage = attackerItem === 'エネルギータンク' && isCharging[attackerKey]
                        ? <span style={{ color: 'orange', fontWeight: 'bold' }}>-&gt; 体が痺れてチャージに失敗！</span>
                        : <span style={{ color: 'orange', fontWeight: 'bold' }}>-&gt; 体が痺れて動けない！</span>;

                    addLog(logMessage, paralysisDetails);
                    
                    if (newStatus[attackerKey].poison > 0) {
                        const poisonDamage = Math.max(1, Math.floor(attackerBase.HP * 0.02));
                        const poisonDetails = (
                            <div>
                                <p><u>毒ダメージ計算</u></p>
                                <p>最大HPの<b>2%</b>のダメージを受けます。</p>
                                <p>計算式: {attackerBase.HP} (最大HP) * 0.02 = {(attackerBase.HP * 0.02).toFixed(2)}</p>
                                <p>結果: <b>{poisonDamage}ダメージ</b> (最低1)</p>
                            </div>
                        );
                        finalHp[attackerKey] -= poisonDamage;
                        addLog(<span style={{ color: 'green' }}>-&gt; {attacker.NAME}は毒のダメージを受けた！({poisonDamage}ダメージ)</span>, poisonDetails);
                        newStatus[attackerKey].poison -= 1;
                    }

                    if (newStatus[attackerKey].confusion > 0) newStatus[attackerKey].confusion -= 1;
        
                    setBattleLog(prev => [...prev, ...newLog]);
                    setHp(finalHp);
                    
                    const nextStatus = JSON.parse(JSON.stringify(newStatus));
                    if (nextStatus[attackerKey].paralysis > 0) nextStatus[attackerKey].paralysis -= 1;
                    setStatusEffects(nextStatus);
                    setShields(newShields);
                    setShieldCooldowns(newShieldCooldowns);
                    setBandanaUsed(newBandanaUsed);

                    setCurrentPlayer(defenderNum);
                    return;
                }
            }
        }
        
        if (attackerItem === 'エネルギータンク' && isCharging[attackerKey]) {
            addLog(`-> エネルギー充填完了！`);
            setIsCharging(prev => ({ ...prev, [attackerKey]: false }));
            if (newStatus[attackerKey].poison > 0) {
                const poisonDamage = Math.max(1, Math.floor(attackerBase.HP * 0.02));
                const poisonDetails = (
                    <div>
                        <p><u>毒ダメージ計算</u></p>
                        <p>最大HPの<b>2%</b>のダメージを受けます。</p>
                        <p>計算式: {attackerBase.HP} (最大HP) * 0.02 = {(attackerBase.HP * 0.02).toFixed(2)}</p>
                        <p>結果: <b>{poisonDamage}ダメージ</b> (最低1)</p>
                    </div>
                );
                finalHp[attackerKey] -= poisonDamage;
                addLog(<span style={{ color: 'green' }}>-&gt; {attacker.NAME}は毒のダメージを受けた！({poisonDamage}ダメージ)</span>, poisonDetails);
                newStatus[attackerKey].poison -= 1;
            }

            if (newStatus[attackerKey].confusion > 0) newStatus[attackerKey].confusion -= 1;
            
            setBattleLog(prev => [...prev, ...newLog]);
            setHp(finalHp);
            const nextStatus = JSON.parse(JSON.stringify(newStatus));
            if (nextStatus[attackerKey].paralysis > 0) nextStatus[attackerKey].paralysis -= 1;
            setStatusEffects(nextStatus);
            setShields(newShields);
            setShieldCooldowns(newShieldCooldowns);
            setBandanaUsed(newBandanaUsed);
            setCurrentPlayer(defenderNum);
            return;
        }

        // 混乱チェック & ターゲット決定
        let effectiveDefender = defender;
        let effectiveDefenderBase = defenderBase;
        let effectiveDefenderKey = defenderKey;
        let effectiveDefenderItem = defenderItem;
        let isSelfHit = false;

        if (newStatus[attackerKey].confusion > 0) {
             const confusionRoll = Math.random();
             if (confusionRoll < 0.3) {
                 isSelfHit = true;
                 effectiveDefender = attacker;
                 effectiveDefenderBase = attackerBase;
                 effectiveDefenderKey = attackerKey;
                 effectiveDefenderItem = attackerItem;
                 addLog(<span style={{ color: 'purple', fontWeight: 'bold' }}>-&gt; {attacker.NAME}は混乱している！自分自身を攻撃してしまった！</span>);
             } else {
                 addLog(<span style={{ color: 'purple' }}>-&gt; {attacker.NAME}は混乱しているが、なんとか相手を狙った！</span>);
             }
             newStatus[attackerKey].confusion -= 1;
        }

        let rouletteEffect: string | null = null;
        if (attackerItem === 'ロウレッテ') {
             let rouletteSuccess = Math.random() < 0.25;
             if (!rouletteSuccess) {
                 const fate = checkFate(attacker.LUK);
                 if (fate.success) {
                     const fateDetails = (
                         <div>
                             <p><u>運命介入判定</u></p>
                             <p>成功率: {fate.chance.toFixed(2)}% (LUK {attacker.LUK})</p>
                             <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                         </div>
                     );
                     addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！ロウレッテ再抽選！</span>, fateDetails);
                     rouletteSuccess = Math.random() < 0.25;
                 }
             }

             if (rouletteSuccess) {
                const effects = ['power', 'pierce', 'poison', 'paralysis', 'confusion', 'lifesteal', 'hit'];
                rouletteEffect = effects[Math.floor(Math.random() * effects.length)];
                const effectNames: {[key: string]: string} = {
                    power: '攻撃力2倍',
                    pierce: '防御貫通',
                    poison: '毒付与',
                    paralysis: '麻痺付与',
                    confusion: '混乱付与',
                    lifesteal: 'HP吸収',
                    hit: '確定命中'
                };
                addLog(<span style={{ color: 'magenta', fontWeight: 'bold' }}>-&gt; ロウレッテ発動！ {effectNames[rouletteEffect]}！</span>);
             }
        }
    
        const attackLoopCount = attackerItem === 'ダメージバースト' ? 5 : 1;
        if (attackerItem === 'ダメージバースト') {
            addLog(<span style={{ color: 'orange', fontWeight: 'bold' }}>-&gt; ダメージバースト発動！1/5の威力で5回攻撃！</span>);
        }

        for (let i = 0; i < attackLoopCount; i++) {
            if (finalHp[attackerKey] <= 0) break; // Attacker died from recoil
            if (finalHp[effectiveDefenderKey] <= 0) break; // Defender died
            
            let scytheMultiplier = 1;

            if (attackerItem === '魂削りの大鎌') {
                const currentHpVal = finalHp[attackerKey];
                const scytheCost = Math.floor(currentHpVal * 0.2);
                scytheMultiplier = Math.max(1, scytheCost / 20);

                const scytheDetails = (
                    <div>
                        <p><u>魂削りの大鎌 効果発動</u></p>
                        <p>現在HP ({currentHpVal}) の<b>20%</b>を消費します。</p>
                        <p>消費量: <b>{scytheCost}</b></p>
                        <p>攻撃倍率: MAX(1, {scytheCost} / 20) = <b>x{scytheMultiplier.toFixed(2)}</b></p>
                    </div>
                );
                
                addLog(<span style={{ color: 'red', fontWeight: 'bold' }}>-&gt; 真紅の一振り(HP{scytheCost}消費、威力{scytheMultiplier.toFixed(2)}倍)</span>, scytheDetails);
                finalHp[attackerKey] -= scytheCost;
                
                if (finalHp[attackerKey] <= 0) {
                     break; // Died from cost
                }
            }

            const isPhysical = Math.random() * 100 < attacker.attackPattern.physical;
            const attackName = isPhysical ? attacker.attackPattern.physicalAttackName : attacker.attackPattern.magicalAttackName;
            const attackType = isPhysical ? '物理' : '魔法';
            if (isCatBattle) {
                addLog(`-> 可愛いネコパンチ！`);
            } else {
                addLog(`-> ${attackName}！ (${attackType})`);
            }
        
            let provisionalDamage = isPhysical ? attacker.ATK : attacker.MATK;

            if (attackerItem === 'スコープ') {
                provisionalDamage = provisionalDamage * (attacker.CDMG / 100);
            }
        
            if (rouletteEffect === 'power') {
                provisionalDamage *= 2;
            }

            if (attackerItem === 'エネルギータンク' && !isCharging[attackerKey]) {
                addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; エネルギータンクの効果で威力が2倍！</span>);
                provisionalDamage *= 2;
            }
            
            if (attackerItem === '魂削りの大鎌') {
                provisionalDamage *= scytheMultiplier;
            }

            if (attackerItem === 'ダメージバースト') {
                provisionalDamage = provisionalDamage / 5;
            }
        
            let isCritical = Math.random() * 100 < (attacker.CRT + newCombo[attackerKey]);
            if (attackerItem === 'スコープ') {
                isCritical = false;
            }
            
            if (isCritical) {
                const baseCritMultiplier = attackerItem === '正義の一閃' ? 4.5 : 1.5;
                provisionalDamage *= (baseCritMultiplier + (attacker.CDMG + newComboC[attackerKey]) / 100);
            }
        
            let baseAVD = effectiveDefender.AVD;
            if (effectiveDefenderItem === 'カウンターの極意書') {
                baseAVD = Math.floor(baseAVD * 1.2);
            }
            let avdBonus = 0;
            if (effectiveDefender.SPD > attacker.SPD) {
                avdBonus = Math.floor((effectiveDefender.SPD - attacker.SPD) / 4);
            }
            const paralysisModifier = newStatus[effectiveDefenderKey].paralysis > 0 ? 0.5 : 1;
            let effectiveAVD = (baseAVD + avdBonus) * paralysisModifier;
            
            // 混乱時はステータスの回避が発生しない
            if (isSelfHit) {
                effectiveAVD = 0;
            }
            
            let effectiveHIT = attacker.HIT + (isCritical ? 50 : 0);
            if (attackerItem === '祝いの剣') {
                effectiveHIT -= 10;
            }

            let hitChance = Math.max(1, (100 + effectiveHIT) - effectiveAVD);
            const hitRoll = Math.random() * 100;
            let isHit = attackerItem === 'スコープ' || rouletteEffect === 'hit' || hitRoll < hitChance;

            // 運命力による命中・回避判定 (再抽選)
            if (!isHit) {
                const fate = checkFate(attacker.LUK);
                if (fate.success) {
                    const fateDetails = (
                        <div>
                            <p><u>運命介入判定 (攻撃側)</u></p>
                            <p>成功率: {fate.chance.toFixed(2)}% (LUK {attacker.LUK})</p>
                            <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                            <p>結果: 成功 -&gt; <b>命中判定再抽選</b></p>
                        </div>
                    );
                    addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！攻撃ミスの運命を書き換える！</span>, fateDetails);
                    
                    const retryRoll = Math.random() * 100;
                    const retryHit = attackerItem === 'スコープ' || rouletteEffect === 'hit' || retryRoll < hitChance;
                    
                    if (retryHit) {
                        isHit = true;
                        addLog(<span style={{ color: 'gold' }}>-&gt; 再抽選の結果... 命中！</span>);
                    } else {
                        addLog(<span style={{ color: 'gray' }}>-&gt; 再抽選の結果... やはりミス！</span>);
                    }
                }
            } else if (isHit && !isSelfHit) { // 自傷行為は回避不可
                const fate = checkFate(effectiveDefender.LUK);
                if (fate.success) {
                     const fateDetails = (
                        <div>
                            <p><u>運命介入判定 (防御側)</u></p>
                            <p>成功率: {fate.chance.toFixed(2)}% (LUK {effectiveDefender.LUK})</p>
                            <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                            <p>結果: 成功 -&gt; <b>回避判定再抽選</b></p>
                        </div>
                    );
                    addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！被弾の運命を書き換える！</span>, fateDetails);
                    
                    const retryRoll = Math.random() * 100;
                    const retryHit = attackerItem === 'スコープ' || rouletteEffect === 'hit' || retryRoll < hitChance;

                    if (!retryHit) {
                        isHit = false;
                        addLog(<span style={{ color: 'gold' }}>-&gt; 再抽選の結果... 回避成功！</span>);
                    } else {
                         addLog(<span style={{ color: 'gray' }}>-&gt; 再抽選の結果... やはり命中！</span>);
                    }
                }
            }

            const hitDetails = (
                <div>
                    <p><u>命中判定</u></p>
                    {attackerItem === 'スコープ' ? (
                        <p><b>スコープの効果で確定命中！</b></p>
                    ) : (
                        rouletteEffect === 'hit' ? (
                            <p><b>ロウレッテの効果で確定命中！</b></p>
                        ) : (
                            <>
                                <p><b>攻撃側:</b></p>
                                <ul>
                                    <li>基本HIT: {attacker.HIT}</li>
                                    {isCritical && <li>クリティカル補正: +50</li>}
                                    {attackerItem === '祝いの剣' && <li>祝いの剣補正: -10</li>}
                                    <li><b>= 有効HIT: {effectiveHIT.toFixed(0)}</b></li>
                                </ul>
                                <p><b>防御側:</b></p>
                                <ul>
                                    <li>基本AVD: {effectiveDefender.AVD}</li>
                                    {isSelfHit && <li><b>混乱: 回避不能 (AVD 0)</b></li>}
                                    {effectiveDefenderItem === 'カウンターの極意書' && <li>カウンターの極意書補正(x1.2): <b>{baseAVD}</b></li>}
                                    {avdBonus > 0 && <li>SPD差補正: +{avdBonus} (SPD {effectiveDefender.SPD} vs {attacker.SPD})</li>}
                                    {paralysisModifier < 1 && <li>麻痺補正: x0.5</li>}
                                    <li><b>= 有効AVD: {effectiveAVD.toFixed(0)}</b></li>
                                </ul>
                                <p><b>最終命中率: {hitChance.toFixed(2)}%</b> (計算式: 100 + {effectiveHIT.toFixed(0)} - {effectiveAVD.toFixed(0)})</p>
                                <p>ダイスロール: <b>{hitRoll.toFixed(2)}</b> / 100 (これが命中率未満ならヒット)</p>
                            </>
                        )
                    )}
                </div>
            );
        
            if (!isHit) {
                addLog(<span style={{ color: 'var(--info-color)' }}>-&gt; ミス！攻撃は当たらなかった。</span>, hitDetails);
                playSound('miss');
                newCombo[attackerKey] = 0;
                newComboC[attackerKey] = 0;
                
                // カウンターは相手からの攻撃かつ相手がカウンターアイテムを持っている場合のみ
                if (!isSelfHit && effectiveDefenderItem === 'カウンターの極意書') {
                    let counterSuccess = Math.random() < 0.5;
                    if (!counterSuccess) {
                         const fate = checkFate(effectiveDefender.LUK);
                         if (fate.success) {
                             const fateDetails = (
                                 <div>
                                     <p><u>運命介入判定</u></p>
                                     <p>成功率: {fate.chance.toFixed(2)}% (LUK {effectiveDefender.LUK})</p>
                                     <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                                 </div>
                             );
                             addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！カウンター判定再抽選！</span>, fateDetails);
                             counterSuccess = Math.random() < 0.5;
                         }
                    }

                    if (counterSuccess) {
                        if (isCatBattle) {
                            addLog(<span style={{ color: 'orange', fontWeight: 'bold' }}>-&gt; 可愛いネコパンチでカウンター！</span>);
                        } else {
                            addLog(<span style={{ color: 'orange', fontWeight: 'bold' }}>-&gt; カウンター！</span>);
                        }
                        const isCounterPhysical = Math.random() < 0.5;
                        const counterBaseDamage = Math.max(1, Math.round((isCounterPhysical ? effectiveDefender.ATK : effectiveDefender.MATK) / 2));
                        
                        let ignoreDefenseRoll = Math.random();
                        let ignoresDefense = ignoreDefenseRoll < 0.3;
                        if (!ignoresDefense) {
                             const fate = checkFate(effectiveDefender.LUK);
                             if (fate.success) {
                                 const fateDetails = (
                                     <div>
                                         <p><u>運命介入判定</u></p>
                                         <p>成功率: {fate.chance.toFixed(2)}% (LUK {effectiveDefender.LUK})</p>
                                         <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                                     </div>
                                 );
                                 addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！防御貫通判定再抽選！</span>, fateDetails);
                                 ignoreDefenseRoll = Math.random();
                                 ignoresDefense = ignoreDefenseRoll < 0.3;
                             }
                        }

                        let defenseReduction = 0;
                        
                        if (ignoresDefense) {
                            addLog(<span style={{ color: 'red', fontWeight: 'bold' }}>-&gt; カウンターで相手の隙をついた！</span>);
                        } else {
                            const counterDefense = isCounterPhysical ? attacker.DEF : attacker.MDEF;
                            const defenseMultiplier = attackerItem === '鎧' ? 1.2 : 0.75;
                            defenseReduction = counterDefense * defenseMultiplier;
                        }

                        let counterFinalDamage = Math.max(0, Math.round(counterBaseDamage - defenseReduction));

                        if (attackerItem === '鎧') {
                            counterFinalDamage = Math.floor(counterFinalDamage * 0.9);
                        }
                        if (isCatBattle) {
                            counterFinalDamage = Math.max(1, Math.floor(counterFinalDamage / 10));
                        } else if (attackerItem === '猫ちゃん装備') {
                            counterFinalDamage = Math.floor(counterFinalDamage * 0.8);
                        }
                        
                        if (attackerItem === '素晴らしい盾') {
                             const cap = Math.floor(attackerBase.HP * 0.3);
                             if (counterFinalDamage > cap) {
                                 counterFinalDamage = cap;
                             }
                        }
                        
                        const counterDetails = (
                            <div>
                                <p><u>カウンターダメージ計算</u></p>
                                <ul>
                                    <li>基本威力: (({isCounterPhysical ? 'ATK' : 'MATK'}) {isCounterPhysical ? effectiveDefender.ATK : effectiveDefender.MATK}) / 2 = {counterBaseDamage.toFixed(0)}</li>
                                    {ignoresDefense ? (
                                        <li><b>防御貫通！</b> (ダイスロール: {ignoreDefenseRoll.toFixed(2)} &lt; 0.3)</li>
                                    ) : (
                                        <li>相手防御軽減: ({isCounterPhysical ? 'DEF' : 'MDEF'}) {isCounterPhysical ? attacker.DEF : attacker.MDEF} * {(attackerItem === '鎧' ? 1.2 : 0.75).toFixed(2)} = {defenseReduction.toFixed(0)} (ダイスロール: {ignoreDefenseRoll.toFixed(2)} &gt;= 0.3)</li>
                                    )}
                                    {attackerItem === '鎧' && <li>鎧ダメージカット: 10%</li>}
                                    {isCatBattle ? (
                                        <li style={{color: 'hotpink'}}>にゃんにゃん対決: 威力 1/10！</li>
                                    ) : (
                                        attackerItem === '猫ちゃん装備' && <li>猫ちゃん装備ダメージカット: 20%</li>
                                    )}
                                    {attackerItem === '素晴らしい盾' && <li>素晴らしい盾上限: {Math.floor(attackerBase.HP * 0.3)}</li>}
                                    <li><b>= 最終ダメージ: {counterFinalDamage}</b></li>
                                </ul>
                            </div>
                        );

                        if (attackerItem === '脆い盾' && newShields[attackerKey]) {
                            addLog(<span style={{ color: 'var(--info-color)', fontWeight: 'bold' }}>-&gt; {attacker.NAME}の脆い盾がカウンターを防いだ！</span>);
                            counterFinalDamage = 0;
                            newShields[attackerKey] = false;
                            newShieldCooldowns[attackerKey] = Math.floor(Math.random() * 3) + 3; // 3 to 5 turns
                        }
            
                        if (counterFinalDamage > 0) {
                            addLog(`-> ${attacker.NAME}にカウンター！${counterFinalDamage}のダメージ！`, counterDetails);
                            finalHp[attackerKey] -= counterFinalDamage;
                        } else {
                            addLog(`-> しかし、カウンターは防がれた！`, counterDetails);
                        }
                    }
                }
            } else { // Attack hits
                if (isCritical) {
                    addLog(<span style={{ color: 'var(--error-color)', fontWeight: 'bold' }}>-&gt; クリティカルヒット！</span>, hitDetails);
                    playSound('critical');
                    if (attackerItem === 'コンボナックル') {
                        const resetRoll = Math.random();
                        if (resetRoll < 0.25) {
                            newCombo[attackerKey] = 0;
                            newComboC[attackerKey] = 0;
                            addLog(<span style={{ color: 'orange', fontWeight: 'bold' }}>-&gt; コンボが途切れてしまった！</span>);
                        }
                    } else {
                        newCombo[attackerKey] = 0;
                        newComboC[attackerKey] = 0;
                    }

                    if (attackerItem === 'スレッジハンマー') {
                        let confusionSuccess = Math.random() < 0.5;
                        if (!confusionSuccess) {
                             const fate = checkFate(attacker.LUK);
                             if (fate.success) {
                                 const fateDetails = (
                                     <div>
                                         <p><u>運命介入判定</u></p>
                                         <p>成功率: {fate.chance.toFixed(2)}% (LUK {attacker.LUK})</p>
                                         <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                                     </div>
                                 );
                                 addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！スレッジハンマー混乱判定再抽選！</span>, fateDetails);
                                 confusionSuccess = Math.random() < 0.5;
                             }
                        }
                        if (confusionSuccess) {
                            const confusionTurns = Math.floor(Math.random() * 5) + 1;
                            addLog(<span style={{ color: 'purple', fontWeight: 'bold' }}>-&gt; スレッジハンマーの一撃！相手は混乱した！</span>);
                            playSound('status');
                            newStatus[effectiveDefenderKey].confusion = confusionTurns;
                        }
                    }
                } else if (attackerItem === 'コンボナックル') {
                    newCombo[attackerKey] += 10;
                    newComboC[attackerKey] += 15;
                    addLog(<span style={{ color: 'lightblue', fontWeight: 'bold' }}>{`-> コンボナックルでCRT+${newCombo[attackerKey]}、CDMG+${newComboC[attackerKey]}!`}</span>, hitDetails);
                    playSound('attack');
                } else {
                    addLog(`-> 攻撃がヒット！`, hitDetails);
                    playSound('attack');
                }
        
                let defense = isPhysical ? effectiveDefender.DEF : effectiveDefender.MDEF;
                // 混乱時はステータスの防御が発生しない
                if (isSelfHit) {
                    defense = 0;
                }

                let isBreak = false;

                if (rouletteEffect === 'pierce') {
                    defense = 0;
                } else if (attackerItem === '鉄斧ブレイキング') {
                    let breakSuccess = Math.random() < 0.15;
                    if (!breakSuccess) {
                         const fate = checkFate(attacker.LUK);
                         if (fate.success) {
                             const fateDetails = (
                                 <div>
                                     <p><u>運命介入判定</u></p>
                                     <p>成功率: {fate.chance.toFixed(2)}% (LUK {attacker.LUK})</p>
                                     <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                                 </div>
                             );
                             addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！鉄斧ブレイク判定再抽選！</span>, fateDetails);
                             breakSuccess = Math.random() < 0.15;
                         }
                    }
                    if (breakSuccess) {
                        defense = 0;
                        isBreak = true;
                        addLog(<span style={{ color: 'red', fontWeight: 'bold' }}>-&gt; 鉄斧ブレイキング効果！ブレイク発動！防御を貫通！</span>);
                    } else {
                        defense *= 0.5;
                    }
                }
        
                const defenseMultiplier = effectiveDefenderItem === '鎧' ? 1.2 : 0.75;
                
                let randomRoll;
                if (attackerItem === 'ギャンブラーダイス') {
                    randomRoll = Math.random() * 3.0;
                } else if (attackerItem === '奇跡のお守り') {
                    randomRoll = 1.0 + Math.random() * 0.2;
                } else {
                    randomRoll = 0.9 + Math.random() * 0.2;
                }

                // 運命力による乱数補正
                if (randomRoll < 1.0) {
                     const fate = checkFate(attacker.LUK);
                     if (fate.success) {
                         const fateDetails = (
                             <div>
                                 <p><u>運命介入判定</u></p>
                                 <p>成功率: {fate.chance.toFixed(2)}% (LUK {attacker.LUK})</p>
                                 <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                             </div>
                         );
                         addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！ダメージ乱数が最大化した！</span>, fateDetails);
                         if (attackerItem === 'ギャンブラーダイス') {
                             randomRoll = 3.0;
                         } else if (attackerItem === '奇跡のお守り') {
                             randomRoll = 1.2;
                         } else {
                             randomRoll = 1.1;
                         }
                     }
                }
                
                let finalDamage = Math.max(0, Math.round((provisionalDamage - (defense * defenseMultiplier)) * randomRoll));
                
                if (effectiveDefenderItem === '鎧') {
                    finalDamage = Math.floor(finalDamage * 0.9);
                }
                if (isCatBattle) {
                    finalDamage = Math.max(1, Math.floor(finalDamage / 10));
                } else if (effectiveDefenderItem === '猫ちゃん装備') {
                    finalDamage = Math.floor(finalDamage * 0.8);
                }
                
                let minDamageLimit = 1;
                if (attackerItem === '祝いの剣') {
                    minDamageLimit = 25;
                }

                finalDamage = Math.max(minDamageLimit, finalDamage);

                if (effectiveDefenderItem === '素晴らしい盾') {
                    const cap = Math.floor(effectiveDefenderBase.HP * 0.3);
                    if (finalDamage > cap) {
                        finalDamage = cap;
                    }
                }

                const criticalMultiplier = ((attackerItem === '正義の一閃' ? 4.5 : 1.5) + (attacker.CDMG + newComboC[attackerKey]) / 100);
                const defenseReduction = (defense * defenseMultiplier);
                const damageAfterDefense = Math.max(1, provisionalDamage - defenseReduction);
                
                const damageDetails = (
                    <div>
                        <p><u>ダメージ計算</u></p>
                        <p><b>攻撃側:</b></p>
                        <ul>
                            <li>基本威力 ({attackType}): {isPhysical ? attacker.ATK : attacker.MATK}</li>
                            {attackerItem === 'スコープ' && <li>スコープ補正: x{attacker.CDMG/100} (CDMG%)</li>}
                            {isCritical && <li>クリティカル倍率: {criticalMultiplier.toFixed(2)}倍 (基礎{attackerItem === '正義の一閃' ? '4.5' : '1.5'} + CDMG補正)</li>}
                            {attackerItem === 'エネルギータンク' && !isCharging[attackerKey] && <li>エネルギータンク: x2</li>}
                            {attackerItem === '魂削りの大鎌' && <li>大鎌倍率: x{scytheMultiplier.toFixed(2)}</li>}
                            {rouletteEffect === 'power' && <li>ロウレッテ: x2</li>}
                            {attackerItem === 'ダメージバースト' && <li>ダメージバースト: x0.2</li>}
                            {fieldEffect === 'ARENA' && <li>闘技場(ATK+50%): 適用済み</li>}
                            {fieldEffect === 'MAGIC_LIBRARY' && <li>魔法図書館(MATK+50%): 適用済み</li>}
                            <li><b>= ダメージ基礎値: {provisionalDamage.toFixed(0)}</b></li>
                        </ul>
                        <p><b>防御側:</b></p>
                        <ul>
                            <li>基本防御: {isPhysical ? effectiveDefender.DEF : effectiveDefender.MDEF}</li>
                            {isSelfHit && <li><b>混乱: 防御不能 (DEF/MDEF無視)</b></li>}
                            {rouletteEffect === 'pierce' ? (
                                <li><b>ロウレッテ: 防御無視！</b></li>
                            ) : (
                                attackerItem === '鉄斧ブレイキング' && (isBreak ? 
                                    <li><b>鉄斧ブレイク: 防御無視！</b></li> :
                                    <li>防御半減補正: x0.5</li>
                                )
                            )}
                            {effectiveDefenderItem === '鎧' && <li>鎧補正: x1.2 (通常x0.75)</li>}
                            {fieldEffect === 'SNOWY_MOUNTAIN' && <li>極寒の雪山(DEF/MDEF半減): 適用済み</li>}
                            <li><b>= 防御軽減値: {defenseReduction.toFixed(0)}</b></li>
                        </ul>
                        <p><b>最終計算:</b></p>
                        <ul>
                            <li>ダメージ(防御後): {damageAfterDefense.toFixed(0)}</li>
                            <li>乱数補正: x{randomRoll.toFixed(2)} (範囲: {attackerItem === 'ギャンブラーダイス' ? '0~3.0' : attackerItem === '奇跡のお守り' ? '1.0~1.2' : '0.9~1.1'})</li>
                            {effectiveDefenderItem === '鎧' && <li>鎧ダメージカット: 10%</li>}
                            {isCatBattle ? (
                                <li style={{color: 'hotpink'}}>にゃんにゃん対決: 威力 1/10！</li>
                            ) : (
                                effectiveDefenderItem === '猫ちゃん装備' && <li>猫ちゃん装備ダメージカット: 20%</li>
                            )}
                            {effectiveDefenderItem === '素晴らしい盾' && <li>素晴らしい盾上限: {Math.floor(effectiveDefenderBase.HP * 0.3)}</li>}
                            <li><b>= 最終ダメージ: {finalDamage}</b> (最低{minDamageLimit})</li>
                            <li style={{marginTop: '0.5rem'}}><i>計算式: ((基礎値 - 防御軽減値) * 乱数補정) * (各種カット)</i></li>
                        </ul>
                    </div>
                );

                if (effectiveDefenderItem === '脆い盾' && newShields[effectiveDefenderKey]) {
                    addLog(<span style={{ color: 'var(--info-color)', fontWeight: 'bold' }}>-&gt; 脆い盾が攻撃を防いだ！</span>, damageDetails);
                    finalDamage = 0;
                    newShields[effectiveDefenderKey] = false;
                    newShieldCooldowns[effectiveDefenderKey] = Math.floor(Math.random() * 3) + 3; // 3 to 5 turns
                }
        
                let isEnergyConverted = false;
                if (effectiveDefenderItem === 'エネルギー変換装置' && finalDamage > 0) {
                    let convertSuccess = Math.random() < 0.15;
                    if (!convertSuccess) {
                         const fate = checkFate(effectiveDefender.LUK);
                         if (fate.success) {
                             const fateDetails = (
                                 <div>
                                     <p><u>運命介入判定</u></p>
                                     <p>成功率: {fate.chance.toFixed(2)}% (LUK {effectiveDefender.LUK})</p>
                                     <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                                 </div>
                             );
                             addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！エネルギー変換判定再抽選！</span>, fateDetails);
                             convertSuccess = Math.random() < 0.15;
                         }
                    }
                    if (convertSuccess) {
                        isEnergyConverted = true;
                        addLog(<span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>-&gt; エネルギー変換装置が作動！ダメージをエネルギーに変換！</span>);
                        finalHp[effectiveDefenderKey] += finalDamage;
                        addLog(<span style={{ color: 'var(--success-color)' }}>-&gt; {effectiveDefender.NAME}は{finalDamage}回復した！</span>);
                        playSound('heal');
                        finalDamage = 0; // Negate damage effects
                    }
                }

                if (finalDamage > 0) {
                    if (isCritical) {
                        addLog(<span>-&gt; {effectiveDefender.NAME}に<span style={{ color: 'var(--error-color)', fontWeight: 'bold' }}>{finalDamage}</span>のダメージ！</span>, damageDetails);
                    } else {
                        addLog(`-> ${effectiveDefender.NAME}に${finalDamage}のダメージ！`, damageDetails);
                    }
                    
                    const hpBeforeDamage = finalHp[effectiveDefenderKey];
                    finalHp[effectiveDefenderKey] -= finalDamage;

                    if (effectiveDefenderItem === '逆境のバンダナ' && !newBandanaUsed[effectiveDefenderKey] && hpBeforeDamage > 0 && finalHp[effectiveDefenderKey] <= 0) {
                        let bandanaRoll = Math.random();
                        let bandanaSuccess = bandanaRoll < 0.5;
                        if (!bandanaSuccess) {
                             const fate = checkFate(effectiveDefender.LUK);
                             if (fate.success) {
                                 const fateDetails = (
                                     <div>
                                         <p><u>運命介入判定</u></p>
                                         <p>成功率: {fate.chance.toFixed(2)}% (LUK {effectiveDefender.LUK})</p>
                                         <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                                     </div>
                                 );
                                 addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！逆境のバンダナ判定再抽選！</span>, fateDetails);
                                 bandanaRoll = Math.random();
                                 bandanaSuccess = bandanaRoll < 0.5;
                             }
                        }

                        if (bandanaSuccess) {
                            const survivedHp = Math.max(1, Math.floor(effectiveDefenderBase.HP / 3));
                            const bandanaDetails = (
                                <div>
                                    <p><u>逆境のバンダナ 踏ん張り判定</u></p>
                                    <p>発動確率<b>50%</b>です。</p>
                                    <p>ダイスロール: <b>{bandanaRoll.toFixed(2)}</b> / 1.0</p>
                                    <p>結果: {bandanaRoll.toFixed(2)} &lt; 0.50 のため、<b>発動成功</b>。</p>
                                    <p>最大HPの1/3 (<b>{survivedHp}</b>)で耐えます。</p>
                                </div>
                            );
                            addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; {effectiveDefender.NAME}は逆境のバンダナで持ちこたえた！</span>, bandanaDetails);
                            finalHp[effectiveDefenderKey] = survivedHp;
                            newBandanaUsed[effectiveDefenderKey] = true;
                            playSound('item_activate');
                        }
                    }
                }

                if (finalDamage > 0 && attackerItem === '四葉のクローバー' && finalDamage % 4 === 0) {
                    const cloverDetails = (
                        <div>
                            <p><u>四葉のクローバー 追撃判定</u></p>
                            <p>与ダメージ ({finalDamage}) が4の倍数だったため、追撃が発生！</p>
                            <p><b>{finalDamage}</b>の防御無視ダメージ！</p>
                        </div>
                    );
                    addLog(<span style={{ color: 'green', fontWeight: 'bold' }}>-&gt; よかったね() {finalDamage}の追撃！</span>, cloverDetails);
                    finalHp[effectiveDefenderKey] -= finalDamage;
                }

                if (isCritical && attackerItem === '正義の一閃' && finalDamage > 0) {
                    const healAmount = Math.max(1, Math.floor(attackerBase.HP * 0.1));
                    const healDetails = (
                        <div>
                            <p><u>正義の一閃 回復計算</u></p>
                            <p>最大HPの<b>10%</b>を回復します。</p>
                            <p>計算式: {attackerBase.HP} (最大HP) * 0.1 = {(attackerBase.HP * 0.1).toFixed(2)}</p>
                            <p>結果: <b>{healAmount}回復</b> (最低1)</p>
                        </div>
                    );
                    finalHp[attackerKey] = Math.min(attackerBase.HP, finalHp[attackerKey] + healAmount);
                    addLog(<span style={{ color: 'var(--success-color)' }}>-&gt; 正義の一閃で{healAmount}回復！</span>, healDetails);
                    playSound('heal');
                }

                if (isCritical && attackerItem === '魂削りの大鎌' && finalDamage > 0) {
                    const healAmount = Math.max(1, Math.floor(attackerBase.HP * 0.2));
                    const healDetails = (
                        <div>
                            <p><u>魂削りの大鎌 回復計算</u></p>
                            <p>最大HPの<b>20%</b>を回復します。</p>
                            <p>計算式: {attackerBase.HP} (最大HP) * 0.2 = {(attackerBase.HP * 0.2).toFixed(2)}</p>
                            <p>結果: <b>{healAmount}回復</b> (最低1)</p>
                        </div>
                    );

                    addLog(<span style={{ color: 'red', fontWeight: 'bold' }}>-&gt; 魂を奪い取る！{healAmount}回復！</span>, healDetails);
                    finalHp[attackerKey] = Math.min(attackerBase.HP, finalHp[attackerKey] + healAmount);
                    playSound('heal');
                }
        
                if (rouletteEffect === 'lifesteal' && finalDamage > 0) {
                    const healAmount = Math.max(1, finalDamage);
                    const lifestealDetails = (
                        <div>
                            <p><u>ロウレッテ 回復計算</u></p>
                            <p>与えたダメージの<b>100%</b>を回復します。</p>
                            <p>計算式: {finalDamage} (与ダメージ) * 1.0 = {finalDamage.toFixed(2)}</p>
                            <p>結果: <b>{healAmount}回復</b> (最低1)</p>
                        </div>
                    );
                    finalHp[attackerKey] = Math.min(attackerBase.HP, finalHp[attackerKey] + healAmount);
                    addLog(<span style={{ color: 'var(--success-color)' }}>-&gt; ロウレッテで{healAmount}回復！</span>, lifestealDetails);
                    playSound('heal');
                } else if (attackerItem === '吸血機' && finalDamage > 0) {
                    const healAmount = Math.max(1, Math.floor(finalDamage * 0.35));
                    const lifestealDetails = (
                        <div>
                            <p><u>吸血機 回復計算</u></p>
                            <p>与えたダメージの<b>35%</b>を回復します。</p>
                            <p>計算式: {finalDamage} (与ダメージ) * 0.35 = {(finalDamage * 0.35).toFixed(2)}</p>
                            <p>結果: <b>{healAmount}回復</b> (最低1)</p>
                        </div>
                    );
                    finalHp[attackerKey] = Math.min(attackerBase.HP, finalHp[attackerKey] + healAmount);
                    addLog(<span style={{ color: 'var(--success-color)' }}>-&gt; 吸血機で{healAmount}回復！</span>, lifestealDetails);
                    playSound('heal');
                }
                
                if (rouletteEffect === 'poison' && finalDamage > 0) {
                    addLog(<span style={{ color: 'green', fontWeight: 'bold' }}>-&gt; ロウレッテがヒット！相手は毒になった！</span>);
                    playSound('status');
                    newStatus[effectiveDefenderKey].poison = 3;
                } else if (attackerItem === '毒針' && finalDamage > 0) {
                    let poisonSuccess = Math.random() < 0.2;
                    if (!poisonSuccess) {
                         const fate = checkFate(attacker.LUK);
                         if (fate.success) {
                             const fateDetails = (
                                 <div>
                                     <p><u>運命介入判定</u></p>
                                     <p>成功率: {fate.chance.toFixed(2)}% (LUK {attacker.LUK})</p>
                                     <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                                 </div>
                             );
                             addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！毒針判定再抽選！</span>, fateDetails);
                             poisonSuccess = Math.random() < 0.2;
                         }
                    }
                    if (poisonSuccess) {
                        addLog(<span style={{ color: 'green', fontWeight: 'bold' }}>-&gt; 毒針がヒット！相手は毒になった！</span>);
                        playSound('status');
                        newStatus[effectiveDefenderKey].poison = 7;
                    }
                }

                if (rouletteEffect === 'paralysis' && finalDamage > 0) {
                    addLog(<span style={{ color: 'orange', fontWeight: 'bold' }}>-&gt; ロウレッテの効果で相手は麻痺した！</span>);
                    playSound('status');
                    newStatus[effectiveDefenderKey].paralysis = Math.max(newStatus[effectiveDefenderKey].paralysis, 3);
                }

                if (rouletteEffect === 'confusion' && finalDamage > 0) {
                    addLog(<span style={{ color: 'purple', fontWeight: 'bold' }}>-&gt; ロウレッテの効果で相手は混乱した！</span>);
                    playSound('status');
                    newStatus[effectiveDefenderKey].confusion = Math.max(newStatus[effectiveDefenderKey].confusion, 3);
                }

                if (effectiveDefenderItem === 'とげ' && finalDamage > 0) {
                    let thornDamage = Math.max(1, Math.floor(finalDamage * 0.3));
                    
                    if (attackerItem === '素晴らしい盾') {
                        const cap = Math.floor(attackerBase.HP * 0.3);
                        if (thornDamage > cap) {
                            thornDamage = cap;
                        }
                    }
                    
                    const thornDetails = (
                        <div>
                            <p><u>とげ 反射ダメージ計算</u></p>
                            <p>受けたダメージの<b>30%</b>を反射します。</p>
                            <p>計算式: {finalDamage} (被ダメージ) * 0.3 = {(finalDamage * 0.3).toFixed(2)}</p>
                            {attackerItem === '素晴らしい盾' && <p>素晴らしい盾上限: {Math.floor(attackerBase.HP * 0.3)}</p>}
                            <p>結果: <b>{thornDamage}ダメージ</b> (最低1)</p>
                        </div>
                    );
                    finalHp[attackerKey] -= thornDamage;
                    addLog(<span style={{ color: 'purple' }}>-&gt; とげの効果で{thornDamage}の反射ダメージ！</span>, thornDetails);
                }
                if (effectiveDefenderItem === '帯電スーツ' && finalDamage > 0) {
                    addLog(<span style={{ color: 'orange', fontWeight: 'bold' }}>-&gt; 帯電スーツが反応！相手は麻痺した！</span>);
                    playSound('status');
                    newStatus[attackerKey].paralysis = Math.max(newStatus[attackerKey].paralysis, 2);
                }
            }
            
            if (attackerItem === 'ちくりんちょ') {
                let extraHits = 0;
                const hitDamages: number[] = [];
                let totalDamage = 0;
                
                const addChikurinchoHit = () => {
                    const damage = 1 + Math.floor(Math.random() * 5);
                    hitDamages.push(damage);
                    totalDamage += damage;
                };

                addChikurinchoHit(); // 初撃

                const hitRolls = [];
                let roll = Math.random();
                let success = roll < 0.90;
                hitRolls.push(roll);

                let keepGoing = true;
                while (keepGoing) {
                    if (success) {
                        extraHits++;
                        addChikurinchoHit(); // 追撃
                        roll = Math.random();
                        success = roll < 0.90;
                        hitRolls.push(roll);
                    } else {
                        const fate = checkFate(attacker.LUK);
                        if (fate.success) {
                             const fateDetails = (
                                <div>
                                    <p><u>運命介入判定</u></p>
                                    <p>成功率: {fate.chance.toFixed(2)}% (LUK {attacker.LUK})</p>
                                    <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                                </div>
                            );
                            addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！ちくりんちょ追撃判定再抽選！</span>, fateDetails);
                            roll = Math.random();
                            success = roll < 0.90;
                            hitRolls.push(roll);
                            if (success) {
                                continue;
                            } else {
                                keepGoing = false;
                            }
                        } else {
                            keepGoing = false;
                        }
                    }
                }
                
                if (effectiveDefenderItem === '素晴らしい盾') {
                    const cap = Math.floor(effectiveDefenderBase.HP * 0.3);
                    if (totalDamage > cap) {
                        totalDamage = cap;
                    }
                }
                
                finalHp[effectiveDefenderKey] -= totalDamage;
                
                const chikurinchoDetails = (
                    <div>
                        <p><u>ちくりんちょ判定 (90%で追撃)</u></p>
                        <p><b>ヒット毎のダメージ (1-5):</b> {hitDamages.join(' + ')}</p>
                        <p><b>ダイスロール (0.90未満で成功):</b></p>
                        <ul>
                            {hitRolls.map((r, i) => (
                                <li key={i}>{i+1}回目: {r.toFixed(3)} {r < 0.90 ? '(成功)' : '(失敗)'}</li>
                            ))}
                        </ul>
                         {effectiveDefenderItem === '素晴らしい盾' && <p>素晴らしい盾上限: {Math.floor(effectiveDefenderBase.HP * 0.3)}</p>}
                        <p><b>結果:</b> 初回 + {extraHits}回追撃 = <b>合計{totalDamage}ダメージ</b></p>
                    </div>
                );

                if (extraHits > 0) {
                    addLog(<span style={{ color: 'purple' }}>{`-> ちくりんちょがヒット！ ${extraHits}回の追撃が発生し、合計${totalDamage}ダメージ！`}</span>, chikurinchoDetails);
                } else {
                    addLog(<span style={{ color: 'purple' }}>{`-> ちくりんちょがヒット！(合計${totalDamage}ダメージ)`}</span>, chikurinchoDetails);
                }
            }
            
            if (attackerItem === '爆弾') {
                let bombSuccess = Math.random() < 0.05;
                if (!bombSuccess) {
                     const fate = checkFate(attacker.LUK);
                     if (fate.success) {
                         const fateDetails = (
                             <div>
                                 <p><u>運命介入判定</u></p>
                                 <p>成功率: {fate.chance.toFixed(2)}% (LUK {attacker.LUK})</p>
                                 <p>ロール: <b>{fate.roll.toFixed(2)}</b></p>
                             </div>
                         );
                         addLog(<span style={{ color: 'gold', fontWeight: 'bold' }}>-&gt; 運命介入！爆弾起爆判定再抽選！</span>, fateDetails);
                         bombSuccess = Math.random() < 0.05;
                     }
                }

                if (bombSuccess) {
                    let bombDamage = Math.max(1, Math.floor(attackerBase.HP * 0.2));
                    const targetIsSelf = Math.random() < 0.5;
                    const targetKey = targetIsSelf ? attackerKey : effectiveDefenderKey;
                    const targetName = targetIsSelf ? attacker.NAME : effectiveDefender.NAME;
                    const targetItem = targetIsSelf ? attackerItem : effectiveDefenderItem;
                    const targetBaseHP = targetIsSelf ? attackerBase.HP : effectiveDefenderBase.HP;
                    
                    if (targetItem === '素晴らしい盾') {
                        const cap = Math.floor(targetBaseHP * 0.3);
                        if (bombDamage > cap) {
                            bombDamage = cap;
                        }
                    }
                    
                    const bombDetails = (
                        <div>
                            <p><u>爆弾ダメージ計算</u></p>
                            <p>自分の最大HPの<b>20%</b>の防御無視ダメージを与えます。</p>
                            <p>計算式: {attackerBase.HP} (最大HP) * 0.2 = {(attackerBase.HP * 0.2).toFixed(2)}</p>
                            {targetItem === '素晴らしい盾' && <p>素晴らしい盾上限: {Math.floor(targetBaseHP * 0.3)}</p>}
                            <p>結果: <b>{bombDamage}ダメージ</b> (最低1)</p>
                            <p>ターゲット判定: <b>{targetName}</b> ({targetIsSelf ? '自分' : '相手'})</p>
                        </div>
                    );
                    addLog(<span style={{ color: 'red', fontWeight: 'bold' }}>-&gt; 爆弾が爆発！{targetName}に{bombDamage}のダメージ！</span>, bombDetails);
                    finalHp[targetKey] -= bombDamage;

                    if (effectiveDefenderItem === '爆弾') {
                        addLog(<span style={{ color: 'red', fontWeight: 'bold' }}>-&gt; 誘爆発生！</span>);
                        let inducedBombDamage = Math.max(1, Math.floor(effectiveDefenderBase.HP * 0.2));
                        const inducedTargetIsSelf = Math.random() < 0.5;
                        const inducedTargetKey = inducedTargetIsSelf ? effectiveDefenderKey : attackerKey;
                        const inducedTargetName = inducedTargetIsSelf ? effectiveDefender.NAME : attacker.NAME;
                        const inducedTargetItem = inducedTargetIsSelf ? effectiveDefenderItem : attackerItem;
                        const inducedTargetBaseHP = inducedTargetIsSelf ? effectiveDefenderBase.HP : attackerBase.HP;
                        
                        if (inducedTargetItem === '素晴らしい盾') {
                            const cap = Math.floor(inducedTargetBaseHP * 0.3);
                            if (inducedBombDamage > cap) {
                                inducedBombDamage = cap;
                            }
                        }
                        
                        const inducedBombDetails = (
                            <div>
                                <p><u>誘爆ダメージ計算</u></p>
                                <p>自分の最大HPの<b>20%</b>の防御無視ダメージを与えます。</p>
                                <p>計算式: {effectiveDefenderBase.HP} (最大HP) * 0.2 = {(effectiveDefenderBase.HP * 0.2).toFixed(2)}</p>
                                {inducedTargetItem === '素晴らしい盾' && <p>素晴らしい盾上限: {Math.floor(inducedTargetBaseHP * 0.3)}</p>}
                                <p>結果: <b>{inducedBombDamage}ダメージ</b> (最低1)</p>
                                <p>ターゲット判定: <b>{inducedTargetName}</b> ({inducedTargetIsSelf ? '自分' : '相手'})</p>
                            </div>
                        );
                        addLog(<span style={{ color: 'red', fontWeight: 'bold' }}>-&gt; {effectiveDefender.NAME}の爆弾も爆発！{inducedTargetName}に{inducedBombDamage}のダメージ！</span>, inducedBombDetails);
                        finalHp[inducedTargetKey] -= inducedBombDamage;
                    }
                }
            }
        } // End of attack loop
    
        if (newStatus[attackerKey].poison > 0) {
            const poisonDamage = Math.max(1, Math.floor(attackerBase.HP * 0.02));
            const poisonDetails = (
                <div>
                    <p><u>毒ダメージ計算</u></p>
                    <p>最大HPの<b>2%</b>のダメージを受けます。</p>
                    <p>計算式: {attackerBase.HP} (最大HP) * 0.02 = {(attackerBase.HP * 0.02).toFixed(2)}</p>
                    <p>結果: <b>{poisonDamage}ダメージ</b> (最低1)</p>
                </div>
            );
            finalHp[attackerKey] -= poisonDamage;
            addLog(<span style={{ color: 'green' }}>-&gt; {attacker.NAME}は毒のダメージを受けた！({poisonDamage}ダメージ)</span>, poisonDetails);
            newStatus[attackerKey].poison -= 1;
        }

        const isStatusAilment = newStatus[attackerKey].poison > 0 || newStatus[attackerKey].paralysis > 0 || newStatus[attackerKey].confusion > 0;

        if (attackerItem === 'ヒールオーブ' && !isStatusAilment) {
            const randomPercent = 0.01 + Math.random() * 0.06;
            const healAmount = Math.max(1, Math.floor(attackerBase.HP * randomPercent));
            const healDetails = (
                <div>
                    <p><u>ヒールオーブ 回復計算</u></p>
                    <p>最大HPの<b>1~7%</b>をランダムで回復します。</p>
                    <p>今回の回復率: <b>{(randomPercent * 100).toFixed(2)}%</b></p>
                    <p>計算式: {attackerBase.HP} (最大HP) * {randomPercent.toFixed(4)} = {(attackerBase.HP * randomPercent).toFixed(2)}</p>
                    <p>結果: <b>{healAmount}回復</b> (最低1)</p>
                </div>
            );
            finalHp[attackerKey] = Math.min(attackerBase.HP, finalHp[attackerKey] + healAmount);
            addLog(<span style={{ color: 'var(--success-color)' }}>-&gt; ヒールオーブで{healAmount}回復！</span>, healDetails);
            playSound('heal');
        }

        const nextStatus = JSON.parse(JSON.stringify(newStatus));
        if (nextStatus[attackerKey].paralysis > 0) nextStatus[attackerKey].paralysis -= 1;
    
        setHp(finalHp);
        setStatusEffects(nextStatus);
        setComboBonus(newCombo);
        setComboCBonus(newComboC);
        setBattleLog(prev => [...prev, ...newLog]);
        setShields(newShields);
        setShieldCooldowns(newShieldCooldowns);
        setBandanaUsed(newBandanaUsed);
        
        if (attackerItem === 'エネルギータンク' && !isCharging[attackerKey]) {
            setIsCharging(prev => ({ ...prev, [attackerKey]: true }));
        }
        
        setCurrentPlayer(defenderNum);
    };

    
    useEffect(() => {
        if (isAutoBattle && !winner) {
            const timer = setTimeout(() => {
                handleAttack();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isAutoBattle, winner, currentPlayer, hp, handleAttack]);

    const getHpBarColor = (currentHp: number, maxHp: number) => {
        const percentage = (currentHp / maxHp) * 100;
        if (percentage > 50) return 'var(--hp-high)';
        if (percentage > 20) return 'var(--hp-medium)';
        return 'var(--hp-low)';
    };

    // FIX: Add explicit type to fix type inference issue with useMemo.
    const winnerStats: BattleStats | null = useMemo(() => {
        if (!winner || winner === 'draw') return null;
        return winner === player1.NAME ? player1 : player2;
    }, [winner, player1, player2]);
    
    const renderStatusEffects = (playerKey: 'p1' | 'p2') => {
        const effects = statusEffects[playerKey];
        const effectStrings = [];
        if (effects.poison > 0) effectStrings.push(`毒:${effects.poison}`);
        if (effects.paralysis > 0) effectStrings.push(`麻痺:${effects.paralysis}`);
        if (effects.confusion > 0) effectStrings.push(`混乱:${effects.confusion}`);
        if (effectStrings.length === 0) return null;
        return <p className="player-item" style={{color: 'orange'}}>{effectStrings.join(', ')}</p>;
    }

    const toggleLogDetails = (id: number) => {
        setExpandedLogId(prevId => (prevId === id ? null : id));
    };

    return (
        <div className="battle-screen-container">
             <button
                className="mute-button"
                onClick={() => setIsMuted(!isMuted)}
                aria-label={isMuted ? 'ミュート解除' : 'ミュート'}
            >
                {isMuted ? '🔇' : '🔊'}
            </button>
            <h1>BATTLE</h1>
            <div className="players-display">
                {[modifiedPlayer1, modifiedPlayer2].map((p, index) => {
                    const playerKey = index === 0 ? 'p1' : 'p2';
                    const currentHp = Math.max(0, hp[playerKey]);
                    const maxHp = p.HP;
                    const hpPercentage = (currentHp / maxHp) * 100;
                    const item = index === 0 ? p1ItemName : p2ItemName;
                    return (
                        <div className="player-info-card" key={index}>
                            <h2>{p.NAME}</h2>
                            <p>HP: {currentHp} / {maxHp}</p>
                            <div className="hp-bar-container">
                                <div className="hp-bar" style={{ width: `${hpPercentage}%`, backgroundColor: getHpBarColor(currentHp, maxHp) }}></div>
                            </div>
                            <p className="player-item">アイテム: {item}</p>
                            {renderStatusEffects(playerKey)}
                        </div>
                    );
                })}
            </div>

            <div className="battle-log-container" ref={logContainerRef}>
                {battleLog.map((log) => (
                    <div key={log.id}>
                        <div className="log-message">
                            <span>{log.message}</span>
                            {log.details && (
                                <span 
                                    className="log-details-toggle" 
                                    onClick={() => toggleLogDetails(log.id)}
                                    role="button"
                                    aria-expanded={expandedLogId === log.id}
                                    aria-label="計算詳細を表示"
                                >
                                    [?]
                                </span>
                            )}
                        </div>
                        {expandedLogId === log.id && (
                            <div className="log-details-content">{log.details}</div>
                        )}
                    </div>
                ))}
            </div>

            <div className="auto-battle-container">
                <label htmlFor="auto-battle-toggle">高速バトル</label>
                <input
                    type="checkbox"
                    id="auto-battle-toggle"
                    checked={isAutoBattle}
                    onChange={(e) => setIsAutoBattle(e.target.checked)}
                    disabled={!!winner}
                />
            </div>

            {winner ? (
                <>
                    {winner === 'draw' ? (
                        <div className="winner-announcement" style={{ color: 'var(--info-color)' }}>引き分け！</div>
                    ) : (
                        <div className="winner-announcement">{winner}の勝利！</div>
                    )}
                    
                    {winner !== 'draw' && winnerStats && (
                        <div className="winner-stats-container">
                            <h3>{winnerStats.NAME}のステータス</h3>
                            <div className="winner-stats-grid">
                                {STAT_FIELDS.map(statKey => (
                                    <div key={statKey}>
                                        {/* Fix: Removed unnecessary type cast. */}
                                        {statKey}: <span>{winnerStats[statKey]}</span>
                                    </div>
                                ))}
                                <div>アイテム: <span>{ITEMS[winnerStats.item as ItemName].name}</span></div>
                            </div>
                            <div className="winner-attack-pattern">
                                攻撃パターン:<br />
                                {winnerStats.attackPattern.physicalAttackName}: {winnerStats.attackPattern.physical}% / {winnerStats.attackPattern.magicalAttackName}: {winnerStats.attackPattern.magical}%
                            </div>
                        </div>
                    )}
                    <button className="reset-button" onClick={onReset}>もう一度遊ぶ</button>
                </>
            ) : (
                !isAutoBattle && <button className="attack-button" onClick={handleAttack}>
                    {`攻撃 (${currentPlayer === 1 ? player1.NAME : player2.NAME})`}
                </button>
            )}
        </div>
    );
};


const App: React.FC = () => {
  const [gameState, setGameState] = useState<'start' | 'player1_stats' | 'player1_attack' | 'player1_done' | 'player2_stats' | 'player2_attack' | 'battle'>('start');
  const [player1Stats, setPlayer1Stats] = useState<Stats | null>(null);
  const [player2Stats, setPlayer2Stats] = useState<Stats | null>(null);
  const [player1Attack, setPlayer1Attack] = useState<AttackPattern | null>(null);
  const [player2Attack, setPlayer2Attack] = useState<AttackPattern | null>(null);
  const [maxPoints, setMaxPoints] = useState(DEFAULT_MAX_POINTS);
  const [isAllInMode, setIsAllInMode] = useState(false);
  const [isFieldEffectEnabled, setIsFieldEffectEnabled] = useState(false);
  const [currentFieldEffect, setCurrentFieldEffect] = useState<FieldEffectKey>('NONE');


  const handleStart = () => {
    if (isFieldEffectEnabled) {
        const keys = Object.keys(FIELD_EFFECTS).filter(k => k !== 'NONE') as FieldEffectKey[];
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        setCurrentFieldEffect(randomKey);
    } else {
        setCurrentFieldEffect('NONE');
    }
    setGameState('player1_stats');
  };
  
  const handlePlayer1StatConfirm = (stats: Stats) => {
    setPlayer1Stats(stats);
    setGameState('player1_attack');
  };

  const handlePlayer1AttackConfirm = (pattern: AttackPattern) => {
    setPlayer1Attack(pattern);
    setGameState('player1_done');
  };

  const handleContinueToPlayer2 = () => {
    setGameState('player2_stats');
  };
  
  const handlePlayer2StatConfirm = (stats: Stats) => {
    setPlayer2Stats(stats);
    setGameState('player2_attack');
  };

  const handlePlayer2AttackConfirm = (pattern: AttackPattern) => {
    setPlayer2Attack(pattern);
    setGameState('battle');
  };
  
  const handleReset = () => {
      setGameState('start');
  }

  const handleBackToStats = () => {
    if (gameState === 'player1_attack') {
        setGameState('player1_stats');
    } else if (gameState === 'player2_attack') {
        setGameState('player2_stats');
    }
  };


  const renderGameState = () => {
    switch (gameState) {
      case 'start':
        return (
          <div>
            <h1>ミニマッチ！</h1>
            <div style={{ margin: '2rem 0' }}>
                <label style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                    ステータスポイント上限
                </label>
                <input 
                    type="number" 
                    value={maxPoints} 
                    onChange={(e) => setMaxPoints(Math.max(100, parseInt(e.target.value) || 0))}
                    style={{ fontSize: '1.5rem', width: '150px', padding: '0.5rem', textAlign: 'center' }}
                />
            </div>
            
            <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                        type="checkbox"
                        id="allInMode"
                        checked={isAllInMode}
                        onChange={(e) => setIsAllInMode(e.target.checked)}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    <label htmlFor="allInMode" style={{ fontSize: '1.2rem', cursor: 'pointer', fontWeight: 'bold' }}>
                        全振りモード
                    </label>
                </div>
                 <p style={{fontSize: '0.9rem', color: '#666', marginTop: '-0.5rem'}}>
                    アイテム以外は1つのステータスにしかポイントを振れなくなります。
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                        type="checkbox"
                        id="fieldEffect"
                        checked={isFieldEffectEnabled}
                        onChange={(e) => setIsFieldEffectEnabled(e.target.checked)}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    <label htmlFor="fieldEffect" style={{ fontSize: '1.2rem', cursor: 'pointer', fontWeight: 'bold' }}>
                        フィールド効果あり
                    </label>
                </div>
                 <p style={{fontSize: '0.9rem', color: '#666', marginTop: '-0.5rem'}}>
                    ランダムな地形効果がバトルに影響します。
                </p>
            </div>

            <button className="start-button" onClick={handleStart}>
              スタート
            </button>
          </div>
        );
      case 'player1_stats':
        return <CharacterCreationScreen player="プレイヤー1" onConfirm={handlePlayer1StatConfirm} initialData={player1Stats} maxPoints={maxPoints} isAllInMode={isAllInMode} fieldEffect={currentFieldEffect} />;
      case 'player1_attack':
        return <AttackPatternScreen player="プレイヤー1" onConfirm={handlePlayer1AttackConfirm} initialData={player1Attack} onBack={handleBackToStats} />;
      case 'player1_done':
        return (
          <div>
            <h1>プレイヤー1のキャラクターが作成されました！</h1>
            <p>プレイヤー2に交代してください。</p>
            <button className="start-button" onClick={handleContinueToPlayer2}>
              プレイヤー2の番へ
            </button>
          </div>
        );
      case 'player2_stats':
        return <CharacterCreationScreen player="プレイヤー2" onConfirm={handlePlayer2StatConfirm} initialData={player2Stats} maxPoints={maxPoints} isAllInMode={isAllInMode} fieldEffect={currentFieldEffect} />;
      case 'player2_attack':
        return <AttackPatternScreen player="プレイヤー2" onConfirm={handlePlayer2AttackConfirm} initialData={player2Attack} onBack={handleBackToStats} />;
      case 'battle':
        if (player1Stats && player2Stats && player1Attack && player2Attack) {
            return <BattleScreen 
                player1={{...player1Stats, attackPattern: player1Attack}} 
                player2={{...player2Stats, attackPattern: player2Attack}} 
                onReset={handleReset}
                maxPoints={maxPoints}
                fieldEffect={currentFieldEffect}
            />;
        }
        return <div>キャラクターデータの読み込みに失敗しました。</div>;
      default:
        return <div>無効なゲーム状態です</div>;
    }
  };

  return (
    <div>
      {renderGameState()}
    </div>
  );
};

export default App;
