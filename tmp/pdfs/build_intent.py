from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from pypdf import PdfReader
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf/고래곳간_기획의도.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Malgun', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('MalgunBold', 'C:/Windows/Fonts/malgunbd.ttf'))
pdfmetrics.registerFontFamily('Malgun', normal='Malgun', bold='MalgunBold')

sections = [
('1. 해결하려는 문제와 기획 배경', [
('필요할 때 다시 찾기 어려운 수업 도구', '교사 커뮤니티에서 나눔받은 ‘보석 같은 앱’을 다시 사용하려고 게시글과 대화 기록을 매번 찾아야 하는 번거로움을 경험함.'),
('제작자가 반복해서 공유해야 하는 업데이트', '직접 만든 앱을 나눈 뒤 기능을 개선하거나 오류를 수정할 때마다 다시 공유하고 변경 사항을 안내해야 했음. 제작자의 개선 노력과 사용자의 활용이 지속적으로 연결될 필요를 느낌.'),
('제작에서 재사용으로 이어지는 공유 공간의 필요', '바이브코딩으로 도구를 만드는 기회는 늘었으나, 결과물과 제작 경험이 개인 기기와 커뮤니티에 흩어져 있음. 좋은 도구를 모아 두고 수업에 맞게 수정하여 다시 나누는 공간을 기획함.'),
('‘고래곳간’에 담은 의미', '웨일을 상징하는 ‘고래’와 필요한 것을 모아 두었다가 함께 꺼내 쓰는 ‘곳간’을 결합함. 교사와 학생의 아이디어와 제작 경험을 공동의 수업 자산으로 축적한다는 뜻을 담음.'),
]),
('2. 핵심 기능과 웨일 도구 연계', [
('도구 탐색·보관·공유', '검수된 작품을 제공하는 ‘인증 곳간’, 누구나 작품을 나누는 ‘나눔 곳간’, 자신의 기기에 보관하는 ‘내 곳간’을 구성함. 검색, 학급 꾸러미, 바로 실행 링크로 필요한 도구를 찾고 전달하도록 함.'),
('제작 경험 공유와 리믹스', '사용 방법과 프롬프트 레시피를 함께 제공하고, 원본을 수정하는 리믹스와 버전 계보를 통해 제작·개선 과정을 이어 가도록 함.'),
('수업 활용 전 점검 지원', '자동 안전 점검, 검수 서명 확인, HTML 격리 실행을 통해 교사가 도구의 활용 여부를 판단하도록 지원함. 별도 계정 없이 시작하고 작품을 기본적으로 기기에 저장하여 도입 부담을 줄이고자 함.'),
('웨일의 수업·협업 환경과 연결', '웨일 사이드바에서 수업 화면을 유지한 채 도구를 탐색·활용함. 웨일 클래스에는 꾸러미와 과제 안내문을 게시하고, 팀보드에는 작품을 전시하여 피드백을 주고받도록 함. 웨일온에서는 온라인 학습과 교사 연수 시 다양한 학습·업무 도구를 공유하고 함께 활용하도록 함.'),
]),
('3. 기대 효과', [
('교사의 수업 준비 부담 경감', '흩어진 앱을 반복해서 찾는 수고를 줄이고, 기존 도구를 수업에 맞게 수정·활용하여 제작 경험을 공동으로 축적할 수 있을 것으로 기대함.'),
('학생의 제작 목적과 개선 경험 확대', '자신의 작품이 다른 사람의 학습에 활용되는 경험을 제공하고, 동료의 피드백을 반영하여 결과물을 개선하는 활동으로 연결하고자 함.'),
('지속적인 나눔과 재사용 문화 형성', '프롬프트와 출처를 함께 공유하여 AI 활용 방법을 배우고 제작자의 기여를 존중하도록 함. 한 사람의 제작 경험이 다른 교실의 출발점이 되는 문화를 지향함.'),
]),
('4. 향후 발전 방향', [
('웨일 로그인 연계 및 업데이트 전달 개선', '웨일 로그인 연계로 제작자 확인과 개인 곳간의 기기 간 이용을 지원하고자 함. 즐겨찾기한 앱의 업데이트 알림과 최신 버전 확인으로 반복 검색·재공유의 부담을 줄일 계획임.'),
('공동체 기여를 인정하는 보상시스템 고도화', '작품 나눔뿐 아니라 검수, 활용 후기, 리믹스 등 도구의 활용과 개선에 기여한 활동을 인정하도록 발전시키고자 함.'),
('제작자 권리와 출처 보호 강화', '최초 제작자의 작품 지문 등록, 원작 출처와 수정 이력 기록, 이용·재배포 조건 표시를 통해 제작자의 기여를 확인하고 존중하도록 할 계획임.'),
('수업 맥락에 맞는 추천과 활용 사례 축적', '교과·학년·성취기준별 탐색과 추천을 보완하고, 실제 수업 활용 사례를 함께 제공하여 필요한 교실에 적합한 도구가 전달되도록 발전시키고자 함.'),
]),
]

W, H = A4
MARGIN = 38
WIDTH = W - MARGIN * 2
NAVY = HexColor('#153947')
INK = HexColor('#20292D')

def layout(size):
    style = ParagraphStyle('body', fontName='Malgun', fontSize=size, leading=size * 1.38,
        textColor=INK, wordWrap='CJK', splitLongWords=True, leftIndent=9)
    head = ParagraphStyle('heading', fontName='MalgunBold', fontSize=11.3,
        leading=16, textColor=NAVY)
    result = []
    for title, bullets in sections:
        p = Paragraph(escape(title), head)
        _, h = p.wrap(WIDTH, H)
        result.append((p, h, 4))
        for label, body in bullets:
            p = Paragraph('• <b>' + escape(label) + '</b>  ' + escape(body), style)
            _, h = p.wrap(WIDTH, H)
            result.append((p, h, 3))
        result.append((None, 0, 7))
    return result

available = H - 109 - 35
for size in [10.5, 10.3, 10.1, 10.0, 9.9, 9.8, 9.7]:
    content = layout(size)
    needed = sum(h + gap for _, h, gap in content)
    if needed <= available:
        break
else:
    raise RuntimeError(f'One-page layout does not fit: {needed:.1f} > {available:.1f}')

c = canvas.Canvas(str(OUT), pagesize=A4)
c.setTitle('고래곳간 기획의도')
c.setAuthor('')
c.setSubject('출품용 기획의도: 해결하려는 문제, 핵심 기능, 기대 효과 및 향후 발전 방향')
c.setFillColor(NAVY)
c.setFont('MalgunBold', 21)
c.drawString(MARGIN, H - 55, '고래곳간 기획의도')
c.setFont('Malgun', 10.8)
c.drawString(MARGIN, H - 77, '수업에 필요한 도구를 모아, 나누고, 이어 쓰다')
c.setStrokeColor(HexColor('#A3BFC6'))
c.setLineWidth(0.8)
c.line(MARGIN, H - 91, W - MARGIN, H - 91)
y = H - 109
for p, height, gap in content:
    if p is not None:
        p.drawOn(c, MARGIN, y - height)
    y -= height + gap
c.showPage()
c.save()

reader = PdfReader(OUT)
assert len(reader.pages) == 1
page = reader.pages[0]
assert abs(float(page.mediabox.width) - W) < 0.1
assert abs(float(page.mediabox.height) - H) < 0.1
text = page.extract_text()
for heading, bullets in sections:
    assert heading in text, heading
    for label, body in bullets:
        compact = lambda value: ''.join(value.split())
        assert compact(label) in compact(text), label
        assert compact(body) in compact(text), label
print(json.dumps({'path': str(OUT), 'pages': len(reader.pages), 'page_size': 'A4',
    'body_font_pt': size, 'content_height_pt': round(needed, 1), 'bottom_pt': round(y, 1),
    'all_15_bullets_verified': True}, ensure_ascii=False))
