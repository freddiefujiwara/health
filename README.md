# health（健康可視化フロントエンド）

Google スプレッドシート「health」のデータを可視化するダッシュボードです。
バックエンドは [health-gas](https://github.com/freddiefujiwara/health-gas)（Google Apps Script）で、
フロントエンドは姉妹サイト [asset（資産可視化）](https://github.com/freddiefujiwara/asset) と同じ
Vue 3 + Vite + Pinia + vue-router + D3 の構成・デザインに揃えています。

## 画面

- **概要** (`/overview`)：最新体重・体脂肪率・筋肉量・内臓脂肪レベル、目標までの距離と進捗、
  直近7日の平均摂取・収支・歩数、体重推移グラフ、投薬情報
- **体組成** (`/body`)：体重・体脂肪率・筋肉量の推移グラフ、TANITA測定履歴、部位別
- **食事** (`/nutrition`)：直近30日の摂取・収支グラフ（摂取目安ライン付き）、期間集計、日別一覧
- **歩数** (`/steps`)：直近30日の歩数グラフ、平均・合計、日別一覧

ダーク／ライトテーマ切替と、数値をぼかすプライバシーモード（asset と同じ仕様）を備えます。

## データ取得

- 本番：health-gas の Web アプリ URL から `fetch` で取得（認証なし）
- 取得に失敗した場合は `src/mocks/sampleApi.json`（スナップショット）にフォールバックし、
  その旨を表示します

## 開発

```bash
npm install
npm run dev        # 開発サーバ
npm test           # vitest
npm run test:coverage  # domain / stores はカバレッジ100%を維持
npm run build      # dist/ へビルド（base: /health/）
```

## デプロイ

GitHub Pages を想定しています（asset と同様、main への push で
テスト → ビルド → gh-pages へデプロイする CI を `.github/workflows/node.js.yml` に置きます）。
公開URLは https://freddiefujiwara.com/health/ を想定しています。

## ライセンス

MIT
