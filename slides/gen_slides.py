# Rootie ハッカソンプレゼン資料ジェネレータ（python-pptx）
# Google Slides連携APIが使えないため、Google Slidesにインポート可能なPPTX形式で生成
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
import os

IVORY = RGBColor(0xFB, 0xF8, 0xF1); CREAM = RGBColor(0xFF, 0xF7, 0xE8)
GREEN = RGBColor(0x6E, 0x8F, 0x66); GREEN_L = RGBColor(0xA8, 0xC8, 0xA0); GREEN_BG = RGBColor(0xF0, 0xF6, 0xEC)
ORANGE = RGBColor(0xE0, 0x9A, 0x5A); ORANGE_L = RGBColor(0xF5, 0xC9, 0x9B)
INK = RGBColor(0x4A, 0x42, 0x38); SUB = RGBColor(0x8C, 0x84, 0x78); WHITE = RGBColor(0xFF, 0xFF, 0xFF)

prs = Presentation(); prs.slide_width = Inches(13.333); prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]

def bg(slide, color=IVORY):
    slide.background.fill.solid(); slide.background.fill.fore_color.rgb = color

def box(slide, x, y, w, h, fill=WHITE, line=None, radius=True):
    from pptx.enum.shapes import MSO_SHAPE
    sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE, x, y, w, h)
    sh.fill.solid(); sh.fill.fore_color.rgb = fill
    if line: sh.line.color.rgb = line; sh.line.width = Pt(1)
    else: sh.line.fill.background()
    return sh

def txt(slide, x, y, w, h, text, size=18, color=INK, bold=False, align=PP_ALIGN.LEFT, font="Hiragino Sans"):
    tb = slide.shapes.add_textbox(x, y, w, h); tf = tb.text_frame; tf.word_wrap = True
    lines = text.split("\n")
    for i, l in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align; r = p.add_run(); r.text = l
        r.font.size = Pt(size); r.font.color.rgb = color; r.font.bold = bold; r.font.name = font
    return tb

def accent(slide, y=Inches(0.28)):
    box(slide, Inches(0.55), y, Inches(0.5), Inches(0.09), GREEN_L)

def title(slide, t, sub=None):
    accent(slide)
    txt(slide, Inches(1.25), Inches(0.12), Inches(11.5), Inches(0.6), t, 26, INK, True)
    if sub: txt(slide, Inches(1.25), Inches(0.62), Inches(11.5), Inches(0.4), sub, 12, SUB)

def mascot(slide, x, y, s=Inches(0.9)):
    c = slide.shapes.add_shape(1, x + s*0.2, y + s*0.25, int(s*0.6), int(s*0.6))  # face circle
    from pptx.enum.shapes import MSO_SHAPE
    c = slide.shapes.add_shape(MSO_SHAPE.OVAL, x + s*0.18, y + s*0.28, int(s*0.64), int(s*0.64)); c.fill.solid(); c.fill.fore_color.rgb = ORANGE_L; c.line.fill.background()
    t1 = slide.shapes.add_shape(MSO_SHAPE.OVAL, x + s*0.05, y, int(s*0.45), int(s*0.35)); t1.fill.solid(); t1.fill.fore_color.rgb = GREEN_L; t1.line.fill.background()
    t1.rotation = -15

# ---------------- 1. Vision ----------------
s = prs.slides.add_slide(BLANK); bg(s)
mascot(s, Inches(0.55), Inches(0.55), Inches(1.6))
txt(s, Inches(0.55), Inches(2.1), Inches(12.2), Inches(1.1), "人に寄り添い、習慣を育てるAIパートナー", 40, INK, True)
txt(s, Inches(0.55), Inches(2.95), Inches(12.2), Inches(0.8), "Rootie（ルーティー）", 30, GREEN, True)
cards = [
    ("ジムの課題", "会員の約半数が\n3ヶ月以内に退会。\n「行けない罪悪感」で\n離れていく。"),
    ("なぜAIが必要か", "続かない原因は一人ひとり違い、\n分析・介入・評価を\n繰り返す必要がある。\n人が全員に寄り添うのは不可能。"),
    ("Rootieの価値", "👤 会員: 自分に合った方法で\n無理なく運動習慣がつく\n🏟 ジム: 会員ごとの状態と\nAIの介入方針が見える"),
]
for i, (h, b) in enumerate(cards):
    x = Inches(0.55 + i * 4.18)
    box(s, x, Inches(4.0), Inches(3.9), Inches(2.9), CREAM if i < 2 else GREEN_BG)
    txt(s, x + Inches(0.25), Inches(4.25), Inches(3.4), Inches(0.5), h, 17, GREEN, True)
    txt(s, x + Inches(0.25), Inches(4.8), Inches(3.5), Inches(2.0), b, 13, INK)

# ---------------- 2. Why Harness? ----------------
s = prs.slides.add_slide(BLANK); bg(s)
title(s, "一つのAIではなく、専門エージェントが協調する", "Why Harness? — 単一LLMでは実現できない「賢く・人に寄り添う」判断")
left = [
    ("単一AIの限界", "・全部を1つのプロンプトに詰めると判断が曖昧に\n・なぜその介入か根拠が説明できない\n・一度失敗しても学び・改善が残らない"),
    ("Harnessの利点", "・役割分担で分析・戦略・調整の精度向上\n・判断根拠・実行履歴が全部ログに残る\n・評価結果が次回のメソッド選択に還元"),
]
for i, (h, b) in enumerate(left):
    y = Inches(1.3) + Inches(i * 2.9)
    box(s, Inches(0.55), y, Inches(5.6), Inches(2.6), WHITE)
    txt(s, Inches(0.85), y + Inches(0.15), Inches(5.0), Inches(0.5), h, 16, ORANGE if i == 0 else GREEN, True)
    txt(s, Inches(0.85), y + Inches(0.7), Inches(5.1), Inches(1.8), b, 13, INK)
box(s, Inches(6.5), Inches(1.3), Inches(6.3), Inches(5.5), GREEN_BG)
txt(s, Inches(6.8), Inches(1.5), Inches(5.8), Inches(0.5), "Orchestrator が統括する分析→判断→実行→評価の循環", 15, GREEN, True)
steps = ["① Behavior Analysis\n行動データから阻害要因・ステージを分析", "② Habit Strategy\nCALENDARメソッド15種から最適手法を選択", "③ Personalization\n性格・生活リズムに合わせ声かけを調整", "④ Feedback & Evaluation\n反応を評価し、知識グラフへ学習を蓄積"]
for i, st in enumerate(steps):
    box(s, Inches(6.9), Inches(2.15) + Inches(i * 1.05), Inches(5.5), Inches(0.9), WHITE, GREEN_L)
    txt(s, Inches(7.1), Inches(2.22) + Inches(i * 1.05), Inches(5.1), Inches(0.8), st, 12, INK)
    if i < 3:
        txt(s, Inches(9.4), Inches(2.72) + Inches(i * 1.05), Inches(0.5), Inches(0.4), "↓", 16, GREEN, True)
txt(s, Inches(6.9), Inches(6.3), Inches(5.8), Inches(0.4), "↺ 評価結果が次の介入方針に自動反映（継続改善ループ）", 12, ORANGE, True)

# ---------------- 3. Architecture ----------------
s = prs.slides.add_slide(BLANK); bg(s)
title(s, "Rootieを動かすマルチエージェントHarness", "Architecture — 専門エージェント連携と共有知識グラフ")
# Orchestrator center top
box(s, Inches(4.7), Inches(1.35), Inches(3.9), Inches(0.75), GREEN)
txt(s, Inches(4.7), Inches(1.47), Inches(3.9), Inches(0.5), "Orchestrator（統括）", 15, WHITE, True, PP_ALIGN.CENTER)
txt(s, Inches(4.5), Inches(2.05), Inches(4.3), Inches(0.3), "タスク分解 / エージェント選択 / 並列実行 / 統合検証", 10, SUB, False, PP_ALIGN.CENTER)
agents = [
    ("Behavior Analysis", "行動分析"), ("Habit Strategy", "習慣化戦略"),
    ("Personalization", "パーソナライズ"), ("Feedback & Evaluation", "評価"),
]
for i, (en, jp) in enumerate(agents):
    x = Inches(0.75 + i * 3.05)
    box(s, x, Inches(2.6), Inches(2.8), Inches(1.0), WHITE, GREEN_L)
    txt(s, x, Inches(2.68), Inches(2.8), Inches(0.4), en, 12, GREEN, True, PP_ALIGN.CENTER)
    txt(s, x, Inches(3.08), Inches(2.8), Inches(0.4), jp + " Agent", 11, INK, False, PP_ALIGN.CENTER)
    # arrow to orchestrator
    ln = s.shapes.add_shape(1, 0, 0, 0, 0)  # placeholder removed below
    from pptx.enum.shapes import MSO_CONNECTOR
    cn = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, x + Inches(1.4), Inches(2.6), Inches(6.65), Inches(2.1)); cn.line.color.rgb = GREEN_L; cn.line.width = Pt(1.5)
# Knowledge graph
box(s, Inches(3.4), Inches(4.0), Inches(6.5), Inches(1.0), CREAM, ORANGE)
txt(s, Inches(3.6), Inches(4.08), Inches(6.2), Inches(0.4), "Knowledge Graph Agent（JSON実装 / Neo4j互換スキーマ）", 13, ORANGE, True, PP_ALIGN.CENTER)
txt(s, Inches(3.6), Inches(4.5), Inches(6.2), Inches(0.4), "User -HAS_BARRIER→ BarrierType -ADDRESSED_BY→ HabitMethod ←INFORMS- Feedback", 9, SUB, False, PP_ALIGN.CENTER)
for i in range(4):
    x = Inches(2.2 + i * 2.4)
    cn = s.shapes.add_connector(1, Inches(6.65), Inches(5.0), x + Inches(0.2), Inches(4.0)) if False else None
# shared context bar
box(s, Inches(0.75), Inches(5.35), Inches(11.8), Inches(0.7), GREEN_BG)
txt(s, Inches(0.95), Inches(5.45), Inches(11.4), Inches(0.5), "共有ワークスペース（黒板）: ユーザープロファイル / 行動履歴 / 分析結果 / 介入履歴 / 実行ログ — 全エージェントが参照・更新", 11, INK, False, PP_ALIGN.CENTER)
# products
box(s, Inches(1.2), Inches(6.35), Inches(4.8), Inches(0.85), WHITE, GREEN)
txt(s, Inches(1.4), Inches(6.42), Inches(4.5), Inches(0.7), "🌱 Rootie Chat（会員向け）\nかわいい・やさしい・罪悪感ゼロの対話", 12, INK)
box(s, Inches(7.0), Inches(6.35), Inches(5.0), Inches(0.85), WHITE, GREEN)
txt(s, Inches(7.2), Inches(6.42), Inches(4.7), Inches(0.7), "🏟 Rootie Admin（ジム運営者向け）\n特性分析・介入方針の可視化とスタッフ調整", 12, INK)
txt(s, Inches(1.2), Inches(6.05), Inches(11), Inches(0.3), "※ エージェント判断は CALENDARメソッド準拠の決定論的ルールエンジン（外部LLM API不使用・コスト0円）。実行履歴は全件記録。", 9, SUB)

# ---------------- 4. Demo ----------------
s = prs.slides.add_slide(BLANK); bg(s)
title(s, "一人ひとりに異なる習慣化支援を", "Demo & Experience — 3人の特性に合わせ、介入も変わる")
base = os.path.dirname(os.path.abspath(__file__))
chat_img = os.path.join(base, "img", "chat.png"); admin_img = os.path.join(base, "img", "admin.png")
try:
    s.shapes.add_picture(chat_img, Inches(0.55), Inches(1.25), height=Inches(3.35))
except Exception as e:
    pass
try:
    s.shapes.add_picture(admin_img, Inches(6.35), Inches(1.25), height=Inches(3.35))
except Exception as e:
    pass
rows = [
    ("Aさん｜忙しくて続かない", "阻害: 忙しくてできない（確信度: 中・推定）", "→ 超ミニマムゴール + チェーンプランニング + 時間帯最適化"),
    ("Bさん｜がんばりすぎ", "阻害: がんばりすぎ（初期高頻度→3週間中断）", "→ 簡単スタート + 超ミニマムゴール + ほめちぎりモチベート"),
    ("Cさん｜習慣が安定", "阻害: なし（達成率92%・定着期）", "→ デイリー進歩チェック + 簡単レコード（過剰介入なし）"),
]
for i, (a, b, c) in enumerate(rows):
    y = Inches(4.75) + Inches(i * 0.78)
    box(s, Inches(0.55), y, Inches(12.25), Inches(0.68), CREAM if i % 2 == 0 else GREEN_BG)
    txt(s, Inches(0.75), y + Inches(0.05), Inches(3.2), Inches(0.55), a, 12, GREEN, True)
    txt(s, Inches(3.95), y + Inches(0.05), Inches(3.9), Inches(0.55), b, 11, INK)
    txt(s, Inches(7.9), y + Inches(0.05), Inches(4.8), Inches(0.55), c, 11, ORANGE, True)
txt(s, Inches(0.55), Inches(7.1), Inches(12.2), Inches(0.3), "左: 会員チャットUI（右上パネルに分析と介入方針がリアルタイム表示）　右: ジム運営者向け管理Web（会員一覧）　※3名は架空のデモデータ", 9, SUB)

# ---------------- 5. Future ----------------
s = prs.slides.add_slide(BLANK); bg(s)
title(s, "習慣化AIを、あらゆるサービスの継続率向上インフラへ", "Future")
items = [
    ("ジム以外への展開", "英語学習・読書・食事管理…\n「続けたい」サービスすべてに\nRootieを組み込める。"),
    ("介入精度の向上", "介入→反応→評価のループが\n知識グラフに蓄積され、\nメソッド選択が自動最適化される。"),
    ("LLMエージェント化", "決定論的エンジンからLLM搭載へ。\n判断根拠の説明性を保ったまま、\nより柔軟な対話が可能に。"),
]
for i, (h, b) in enumerate(items):
    x = Inches(0.55 + i * 4.18)
    box(s, x, Inches(1.45), Inches(3.9), Inches(2.7), GREEN_BG if i == 1 else CREAM)
    txt(s, x + Inches(0.25), Inches(1.7), Inches(3.4), Inches(0.5), h, 16, GREEN, True)
    txt(s, x + Inches(0.25), Inches(2.25), Inches(3.5), Inches(1.8), b, 13, INK)
box(s, Inches(0.55), Inches(4.5), Inches(12.25), Inches(1.5), WHITE, ORANGE_L)
txt(s, Inches(0.85), Inches(4.7), Inches(11.6), Inches(0.5), "Rootieが目指すもの", 16, ORANGE, True)
txt(s, Inches(0.85), Inches(5.2), Inches(11.6), Inches(0.8), "「賢いAI」ではなく、「賢く人に寄り添えるAI」。\nHarnessという設計そのものが、製品の差別化であり、すべての継続サービスの基盤となる。", 15, INK)
mascot(s, Inches(11.6), Inches(6.1), Inches(0.9))
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Rootie_ハッカソンプレゼン.pptx")
prs.save(out)
print("saved:", out)
