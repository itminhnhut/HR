"""Hard CVs: the minority. All people, numbers and addresses are invented. Label fields are written literally.

Extra options (model.Record):
  top             lines above everything
  contact_before  (label, value) rows printed before the candidate's own contact rows
  contact_add     (label, value) rows printed after them
  pre / post      (heading, lines) sections before / after the body
  body_lines      lines added to the first section
  contact_end     contact block printed at the very end of the document
  name_at         'objective' | 'signature' | 'intro' | 'hidden' : where the name is, instead of the header
  name_lines      the name broken over several lines
  name_shown / phone_shown / email_shown  literal text instead of the formatted label
  no_phone_row / no_email_row come from the label being None
  ambiguous       field -> reason (reported apart)
"""
from model import R

REF_VI = 'Người tham chiếu'

TWO_COLUMN = [
    R('h001', 'two_col_y', 'Nguyễn Thị Thanh Hằng', '0386120475', 'thanhhang.ntt@gmail.com', 'acct'),
    R('h002', 'two_col_y', 'Trần Đình Trọng', '0912035764', 'dinhtrong.tr@gmail.com', 'sales', ns='U',
      post=[(REF_VI, ['Ông Võ Thanh Bằng - Giám đốc vùng', 'Di động: 0903 557 214'])]),
    R('h003', 'two_col_mainfirst', 'Lê Thị Bảo Yến', '0934781206', 'baoyen.le@gmail.com', 'hr'),
    R('h004', 'two_col_mainfirst', 'Hà Văn Quyết', '0853027614', 'havanquyet@yahoo.com', 'tech', pf='plain', name_low=True),
    R('h005', 'two_col_cell', 'Phạm Thu Trang', '0775204816', 'thutrang.pham@gmail.com', 'mkt'),
    R('h006', 'two_col_y', 'Vo Hoang Long', '0965283017', 'hoanglong.vo@gmail.com', 'dev_en', ns='U', pf='84sp'),
    R('h007', 'two_col_cell', 'Y Bhuôn Niê', '0834720165', 'ybhuon.nie@gmail.com', 'nurse', ns='T'),
]

REFERENCES = [
    R('h008', 'word_classic', 'Đinh Công Minh', '0987340216', 'congminh.dinh@gmail.com', 'dev', ns='U',
      post=[('Người giới thiệu', ['Bà Nguyễn Thị Lệ Thu - Trưởng phòng Kỹ thuật, Công ty CP Công nghệ Sao Khuê Số',
                                  'Điện thoại: 0903 214 587 - Email: lethu.nguyen@saokhueso.example',
                                  'Ông Hoàng Anh Tú - Tech Lead, Điện thoại: 0978 330 142'])]),
    R('h009', 'canva_side', 'Ngô Thị Lệ Quyên', '0708321945', 'lequyen.ngo@gmail.com', 'cs', refs_first=True,
      pre=[(REF_VI, ['Trần Mạnh Cường - Quản lý cửa hàng', '0946 702 318', 'cuong.tm@tienloinhaminh.example'])]),
    R('h010', 'word_cv', 'Trương Thị Ánh Tuyết', None, 'anhtuyet.truong@gmail.com', 'recept', ns='T',
      post=[('Người xác nhận', ['Bà Lâm Thị Ngọc - Quản lý tiền sảnh, Khách sạn Biển Ngọc Xanh',
                                'Điện thoại: 0913 228 460'])]),
    R('h011', 'topcv_head', 'Lục Văn Thành', '0364901275', None, 'factory',
      post=[(REF_VI, ['Ông Đỗ Văn Khỏe - Quản đốc xưởng', 'Email: khoe.dv@truongthanhtien.example'])]),
    R('h012', 'word_lyl', 'Khúc Thị Hải', '0905318427', 'khuchai.hd@gmail.com', 'teacher', ns='U',
      pre=[('Người giới thiệu', ['Cô Phạm Thị Hiền - Hiệu phó, Trường THCS Lê Lợi Hạ, ĐT: 0983 110 264'])], contact_end=True),
    R('h013', 'vnw_en', 'Dinh Thu Huong', '0941720365', 'thuhuong.dinh@gmail.com', 'hr_en', ns='T',
      post=[('References', ['Mr. Pham Van Duc - Head of Sales, Silver Bamboo Retail JSC',
                            'Mobile: 0903 882 615 | Email: duc.pham@silverbamboo.example',
                            'Ms. Tran Lan Huong - HR Manager, Mobile: +84 977 240 186'])]),
    R('h014', 'word_classic', 'Mai Thế Hiển', '0372184069', 'thehien.mai@gmail.com', 'civil', ns='U',
      post=[('Thông tin người tham chiếu', ['Họ và tên: Trần Văn Sơn', 'Chức vụ: Chỉ huy trưởng công trường',
                                            'Số điện thoại: 0919 603 247'])]),
]

RELATIVES_COMPANY = [
    R('h015', 'word_lyl', 'Hoàng Thị Bích Ngọc', '0819362074', 'bichngoc.hoang@gmail.com', 'acct', ns='T',
      post=[('Quan hệ gia đình', ['Cha: Hoàng Văn Tiến, sinh năm 1965, làm nông, ĐT: 0335 120 784',
                                  'Mẹ: Lê Thị Mận, sinh năm 1968, nội trợ, ĐT: 0981 046 327'])]),
    R('h016', 'canva_center', 'Lê Trung Kiên', '0936107284', 'trungkien.le@gmail.com', 'sales',
      contact_before=[('Liên hệ khẩn cấp (chị gái Lê Thu Hà)', '0989 021 763')]),
    R('h017', 'word_cv', 'Vàng Thị Sủa', None, 'vangsua.yb@gmail.com', 'cs', ns='T',
      post=[('Liên hệ gia đình', ['Mẹ: Lý Thị Pà - 0378 416 029'])]),
    R('h018', 'word_classic', 'Nguyễn Văn Thọ', '0977204156', 'vantho.ng@gmail.com', 'factory', contact_end=True,
      body_lines=['Quản lý trực tiếp: Anh Trần Văn Hải - 0903 417 682']),
    R('h019', 'word_cv', 'Trần Thị Hải Lý', '0397024186', 'haily.tr@gmail.com', 'acct', ns='T', contact_end=True,
      body_lines=['Công ty TNHH Bao bì Tân Việt Hưng - MST: 0312456789 - ĐT: (028) 3822 4176']),
    R('h020', 'word_table', 'Phùng Thị Mến', '0364120875', 'phungmen.pt@gmail.com', 'recept', ns='T', pf='dot',
      contact_add=[('Số CCCD', '025198004512'), ('Tài khoản ngân hàng', '1903 4567 8912 01'),
                   ('Mã số BHXH', '0123456789')]),
    R('h021', 'topcv_min', 'Tăng Minh Khoa', '0902137648', 'minhkhoa.tang@gmail.com', 'logistics',
      body_lines=['Liên hệ công việc hiện tại: khoa.tm@anphuthinh.example, 0903 660 915 (bàn trực điều phối)']),
]

SEVERAL_EMAILS = [
    R('h022', 'word_classic', 'Đoàn Thị Kim Chi', '0948120367', 'kimchi.doan@gmail.com', 'hr', ns='T',
      contact_add=[('Email công ty cũ', 'chi.dtk@hongphatdat.example')]),
    R('h023', 'topcv_head', 'Lê Hữu Nghĩa', '0962013847', 'huunghia.le@gmail.com', 'dev',
      email_shown='huunghia.le@gmail.com / nghia_le91@yahoo.com',
      ambiguous={'email': 'two personal addresses listed with equal standing'}),
    R('h024', 'word_cv', 'Nguyễn Hà Phương', '0332148760', 'ha.phuong.nguyen@gmail.com', 'mkt', ns='T',
      contact_add=[('Email sinh viên', 'phuong.nh21@sv.truongkinhte.example')],
      ambiguous={'email': 'personal and student addresses are both her own'}),
    R('h025', 'canva_band', 'Lý Minh Trí', '0767084213', 'minhtri.ly@gmail.com', 'design',
      top=['Trí Studio | Liên hệ dự án: contact@tristudio.example']),
    R('h026', 'word_cv', 'Thân Thị Hạnh', '0859021746', 'thanhanh.than@gmail.com', 'cs', ns='T',
      top=['Hồ sơ gửi qua Cổng Việc Làm Nhanh - Hỗ trợ: hotro@vieclamnhanh.example - Hotline 1900 6868']),
    R('h027', 'two_col_mainfirst', 'Nguyễn Thị Phương Thảo', '0915026743', 'nguyenthiphuongthao.ketoan1997@gmail.com',
      'acct', email_lines=['nguyenthiphuongthao.ketoan', '1997@gmail.com']),
    R('h028', 'word_table', 'Vũ Đức Mạnh', '0983610247', 'ducmanh.vu@gmail.com', 'tech', ns='T',
      email_shown='ducmanh.vu @ gmail.com'),
]

NAME_POSITIONS = [
    R('h029', 'canva_band', 'Trần Thị Cúc', '0913760284', 'cuctran.kt@gmail.com', 'acct', title_first=True),
    R('h030', 'word_classic', 'Nguyễn Trọng Nghĩa', '0372410865', 'trongnghia.ng@gmail.com', 'logistics', name_at='objective'),
    R('h031', 'word_lyl', 'Lê Văn Bền', '0907321468', 'levanben@gmail.com', 'driver', ns='T', name_at='signature'),
    R('h032', 'canva_side', 'Trần Nguyễn Bảo Châu', '0845120367', 'baochau.tn@gmail.com', 'design',
      name_lines=['TRẦN NGUYỄN', 'BẢO CHÂU']),
    R('h033', 'canva_center', 'Lê Thị Hoa', '0372084915', 'lehoa.design@gmail.com', 'design',
      name_shown='L Ê   T H Ị   H O A'),
    R('h034', 'word_classic', 'Đặng Thu Thảo', '0909713245', 'thuthao.dang@gmail.com', 'cs', name_at='intro',
      intro='Tôi tên là Đặng Thu Thảo, sinh năm 1999 tại Nam Định, có ba năm kinh nghiệm chăm sóc khách hàng.'),
    R('h035', 'vnw_en', 'Linh Pham', '0353201876', 'linh.pham.work@gmail.com', 'hr_en', ns='T'),
    R('h036', 'topcv_min', 'Trần Thanh Tùng', '0919320476', 'tony.tran@gmail.com', 'sales',
      name_shown='Trần Thanh Tùng (Tony)',
      ambiguous={'fullName': 'whether the nickname belongs in the name is debatable'}),
    R('h037', 'canva_side', None, '0398120754', 'lamhoangnam.work@gmail.com', 'mkt', name_at='image',
      image_name='LÂM HOÀNG NAM'),
    R('h038', 'vnw_profile', None, '0326401975', 'ungvien.a20931@hopthu.example', 'cs', name_at='hidden',
      top=['Ứng viên mã số A20931']),
    R('h039', 'word_cv', None, '0845206713', 'kho.nhanvien2024@gmail.com', 'logistics', name_at='hidden',
      top=['HỒ SƠ XIN VIỆC', 'Vị trí ứng tuyển: Nhân viên kho']),
    R('h040', 'word_classic', 'Phạm Minh Trí', '0934208176', 'minhtri.ph@gmail.com', 'sales',
      name_shown='CV - Phạm Minh Trí - Nhân viên kinh doanh'),
]

NO_EMAIL = [
    R('h041', 'word_cv', 'Nguyễn Văn Sáu', '0948201736', None, 'factory', ns='T'),
    R('h042', 'topcv_side', 'Hờ Thị Sông', '0793401268', None, 'cs',
      contact_add=[('Facebook', 'facebook.com/hosong.sapa')]),
    R('h043', 'canva_center', 'Lâm Nhật Hào', '0934026718', None, 'dev',
      contact_add=[('Telegram', '@nhathao_dev'), ('GitHub', 'github.com/nhathao-dev')]),
    R('h044', 'word_lyl', 'Cao Văn Lực', '0868127403', None, 'factory', ns='T',
      body_lines=['Xác minh quá trình công tác qua phòng nhân sự: tuyendung@kimphatsteel.example']),
]

NO_PHONE = [
    R('h045', 'word_classic', 'Trần Thị Mỹ Lệ', None, 'myle.tran@gmail.com', 'teacher'),
    R('h046', 'word_cv', 'Nguyễn Viết Hòa', None, 'viethoa.ng@yahoo.com', 'civil', ns='T',
      contact_add=[('Điện thoại nhà riêng', '(024) 3856 7421')]),
    R('h047', 'topcv_head', 'Phạm Thị Thơm', None, 'thompham.kt@gmail.com', 'acct',
      body_lines=['Công ty TNHH Dệt may Hồng Phát Đạt, MST 0108765432, tổng đài 1800 6655']),
    R('h048', 'word_lyl', 'Lường Thị Nga', None, None, 'recept', ns='T'),
    R('h049', 'word_table', 'Chung Văn Tỷ', None, 'chungty88@gmail.com', 'driver', ns='T',
      contact_add=[('Số CCCD', '036088012745'), ('Mức lương mong muốn', '15.000.000 đồng/tháng')],
      body_lines=['Mức lương gần nhất: 12.500.000 đồng, số sổ BHXH 0123498765']),
]

PHONE_ODDITIES = [
    R('h050', 'word_classic', 'Nguyễn Hoàng Long', '0912640387', 'hoanglong.ng@gmail.com', 'dev',
      phone_shown='0912 640 387 - 0978 305 126', ambiguous={'phone': 'two own mobiles listed with equal standing'}),
    R('h051', 'word_cv', 'Lê Thị Tám', '0383402715', 'letam1985@yahoo.com', 'cs', ns='T', phone_shown='0168 340 2715',
      ambiguous={'phone': 'old 11-digit number; the label is its 2018 conversion, which the CV does not show'}),
    R('h052', 'two_col_mainfirst', 'Trần Phước Thọ', '0936240185', 'thotran.pt@gmail.com', 'tech',
      phone_lines=['0936 240', '185']),
]

HARD = [
    *[r.tag('hard', 'two_column') for r in TWO_COLUMN],
    *[r.tag('hard', 'references') for r in REFERENCES],
    *[r.tag('hard', 'relatives_or_company') for r in RELATIVES_COMPANY],
    *[r.tag('hard', 'several_emails') for r in SEVERAL_EMAILS],
    *[r.tag('hard', 'name_position') for r in NAME_POSITIONS],
    *[r.tag('hard', 'no_email') for r in NO_EMAIL],
    *[r.tag('hard', 'no_phone') for r in NO_PHONE],
    *[r.tag('hard', 'phone_oddity') for r in PHONE_ODDITIES],
]
