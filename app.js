// 古物商許可ナビ：質問の答えから、必要書類のチェックリストを組み立てる。
// 入力・チェックはこの端末の localStorage にだけ保存し、外には送らない。

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const LS_ANS = 'kk-answers';
const LS_DONE = 'kk-done';

function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できない環境でも動く */ } }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const form = $('#q');
let done = lsGet(LS_DONE) || {};

function answers() {
  const f = new FormData(form);
  return {
    type: f.get('type'),
    officers: Math.min(20, Math.max(1, parseInt(f.get('officers'), 10) || 1)),
    manager: f.get('manager'),
    web: f.get('web'),
    nation: f.get('nation'),
    proxy: f.get('proxy'),
  };
}

/** 書類を出す人の一覧（ラベル） */
function people(a) {
  if (a.type === 'kojin') {
    return a.manager === 'self' ? ['あなた（管理者を兼ねる）'] : ['あなた', '管理者'];
  }
  const list = Array.from({ length: a.officers }, (_, i) => (a.officers === 1 ? '代表者' : `役員${i + 1}`));
  if (a.manager === 'other') list.push('管理者（役員以外）');
  return list;
}

/** 答えに合わせた書類リスト。id はチェック状態の保存キー */
function buildDocs(a) {
  const who = people(a);
  const docs = [];
  const add = (group, id, title, whoText, lines, warn) => docs.push({ group, id, title, whoText, lines, warn });

  add('申請書', 'form', '許可申請書（別記様式第1号）', '1部',
    ['様式は、営業所のある都道府県の警察のサイトからダウンロード（警視庁の様式一覧など）',
      a.type === 'hojin' ? '法人用の記載例を見ながら書く。役員が多いときや営業所が複数あるときは別紙あり' : '個人用の記載例を見ながら書く',
      '主として取り扱う古物の区分（美術品類・衣類・時計・宝飾品類 など13区分から1つ）を決めておく'], null);

  if (a.type === 'hojin') {
    add('法人の書類', 'teikan', '定款', '1部（写し）', ['会社で保管している定款'], null);
    add('法人の書類', 'touki', '登記事項証明書', '1通', ['法務局で取得（オンライン請求も可）'], null);
  }

  who.forEach((p, i) => {
    const k = `p${i}`;
    add(`${p}の書類`, `${k}-jumin`, '住民票の写し', '1通',
      ['住んでいる市区町村の窓口など',
        a.nation === 'other' ? '外国籍の人は「国籍等」の記載があるもの' : '「本籍の記載あり」で取る'],
      'マイナンバー（個人番号）が載っていないものにする');
    {
      add(`${p}の書類`, `${k}-mibun`, '身分証明書（本籍地の市区町村が発行）', '1通',
        ['本籍地の市区町村の窓口（戸籍課など）で発行。遠方なら郵送で頼めるか、その市区町村に確認',
          a.nation === 'other' ? '日本国籍の人のみ必要（外国籍の人は不要）' : '破産していないこと等を証明する書類'],
        '運転免許証やマイナンバーカードのことではありません');
    }
    add(`${p}の書類`, `${k}-ryaku`, '略歴書', '1部', ['最近5年間の経歴を書く。様式は都道府県警察のサイト'], null);
    add(`${p}の書類`, `${k}-seiyaku`, '誓約書', '1部',
      [a.type === 'kojin' ? (p.startsWith('管理者') ? '管理者用の誓約書' : '個人用の誓約書')
        : (p.startsWith('管理者') ? '管理者用の誓約書' : '役員用の誓約書'),
        '様式は都道府県警察のサイト（個人用・役員用・管理者用がある）'],
      a.manager === 'self' && (a.type === 'kojin' || i === 0) ? '管理者を兼ねる人は、管理者用の誓約書も出すか、記載例か警察署で確認' : null);
  });

  if (a.web === 'site') {
    add('ネットで売る場合', 'url', 'URLの使用権限を示す資料', '1部',
      ['例：プロバイダ等から届いたURL割り当ての通知書のコピー、ドメイン検索・WHOIS検索の結果の印刷',
        a.type === 'kojin' ? '本人名義で登録されていることが確認できるもの' : '法人名・代表者名・管理者名で登録されていることが確認できるもの',
        'オークションサイトにストアを出す場合も、そのURLの届出が必要（大阪府警）'],
      '人の名義のサイトを使うときは、使用承諾書も必要');
  }
  if (a.web === 'flea') {
    add('ネットで売る場合', 'flea', 'フリマアプリだけで売る場合の扱いを警察署に確認', '電話1本',
      ['フリマアプリで個人として出品するだけのときに、URLの届出がいるかは公式ページに書かれていません。申請前に管轄の警察署に聞いておくと安心です'], null);
  }
  if (a.proxy === 'other') {
    add('提出', 'inin', '委任状', '1部', ['本人以外が警察署に出すときに必要（大阪府警）', '営業内容について答えられる人に頼む'], null);
  }
  add('提出', 'call', '主たる営業所を担当する警察署に、事前に電話で確認', '電話1本',
    ['担当の課（防犯係・生活安全課など）、受付時間、追加で必要な書類を聞いておくと二度手間を防げます'], null);
  add('提出', 'fee', '申請手数料 19,000円', '現金など',
    ['警察署で払う（払い方は署に確認）'], '不許可や取り下げでも返ってきません');
  return docs;
}

function render() {
  const a = answers();
  lsSet(LS_ANS, a);
  $('#qOfficers').hidden = a.type !== 'hojin';
  $('#mgrSelfLabel').textContent = a.type === 'hojin' ? '役員のだれかが兼ねる' : '自分が兼ねる';
  $('#mgrOtherLabel').textContent = a.type === 'hojin' ? '役員以外の人に頼む' : '別の人に頼む';

  const docs = buildDocs(a);
  const groups = [...new Set(docs.map((d) => d.group))];
  $('#list').innerHTML = groups.map((g) => `
    <h3 class="group-title">${esc(g)}</h3>
    ${docs.filter((d) => d.group === g).map((d) => `
      <div class="doc ${done[d.id] ? 'done' : ''}">
        <label class="doc-head">
          <input type="checkbox" data-id="${esc(d.id)}" ${done[d.id] ? 'checked' : ''}>
          <span><span class="doc-title">${esc(d.title)}</span>　<span class="doc-who">${esc(d.whoText)}</span></span>
        </label>
        <div class="doc-body">
          ${d.lines.map((l) => `<p>・${esc(l)}</p>`).join('')}
          ${d.warn ? `<p class="doc-warn">⚠ ${esc(d.warn)}</p>` : ''}
        </div>
      </div>`).join('')}`).join('');
  $$('#list input[type=checkbox]').forEach((c) => c.addEventListener('change', () => {
    done[c.dataset.id] = c.checked;
    lsSet(LS_DONE, done);
    c.closest('.doc').classList.toggle('done', c.checked);
    progress(docs);
  }));
  progress(docs);
  window.__docs = docs;
}

function progress(docs) {
  const n = docs.filter((d) => done[d.id]).length + (done.kakkaku ? 1 : 0);
  const total = docs.length + 1;
  $('#progText').textContent = `そろった：${n} / ${total}`;
  $('#progBar').style.width = `${Math.round((n / total) * 100)}%`;
}

form.addEventListener('change', render);
form.addEventListener('input', render);

$('#kakkaku').checked = !!done.kakkaku;
$('#kakkaku').addEventListener('change', (e) => {
  done.kakkaku = e.target.checked;
  lsSet(LS_DONE, done);
  progress(window.__docs || []);
});

$('#resetBtn').addEventListener('click', () => {
  if (!confirm('チェックを全部外しますか？')) return;
  done = {};
  lsSet(LS_DONE, done);
  $('#kakkaku').checked = false;
  render();
});

$('#printBtn').addEventListener('click', () => {
  const a = answers();
  const docs = window.__docs || buildDocs(a);
  const groups = [...new Set(docs.map((d) => d.group))];
  $('#print').innerHTML = `
    <h1>古物商許可 申請準備チェックリスト</h1>
    <p class="note">${a.type === 'hojin' ? `法人（役員${a.officers}人）` : '個人'}／管理者：${a.manager === 'self' ? '兼ねる' : '別の人'}／ネット販売：${{ site: 'ホームページ・ストア', flea: 'フリマアプリのみ', none: 'なし' }[a.web]}</p>
    ${groups.map((g) => `<h2>${esc(g)}</h2><ul>${docs.filter((d) => d.group === g).map((d) => `<li>${done[d.id] ? '☑' : '☐'} ${esc(d.title)}（${esc(d.whoText)}）${d.warn ? ' ⚠' + esc(d.warn) : ''}</li>`).join('')}</ul>`).join('')}
    <h2>その他</h2><ul><li>${done.kakkaku ? '☑' : '☐'} 欠格事由に当てはまらないことを確認</li><li>許可が出るまで概ね40日（神奈川・大阪の案内）。許可の連絡までは営業できない</li></ul>
    <p class="note">古物商許可ナビ（https://iku081414-coder.github.io/kobutsu-kyoka/）で作成。一般的な目安です。必要な書類は主たる営業所を担当する警察署に確認してください。</p>`;
  window.print();
});

// 前回の答えを戻す
(function restore() {
  const a = lsGet(LS_ANS);
  if (a) {
    for (const [k, v] of Object.entries(a)) {
      const el = form.elements[k];
      if (!el) continue;
      if (el instanceof RadioNodeList) { for (const r of el) r.checked = r.value === v; } else el.value = v;
    }
  }
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* オフライン対応なしでも動く */ });
  }
})();
