from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parents[1]
art = root / 'src/main/resources/static/images/game/customer-walk-v3'
metadata = json.loads((art / 'sprites.json').read_text(encoding='utf-8'))
assert metadata['frames'] == 16
readme = '''蓝衣顾客四方向行走动作 v3

上 north / 下 south / 左 west / 右 east，每个方向 16 帧。
单帧透明 PNG：96 × 96 像素，统一脚底基准 (48, 91)。
按 walk-00.png 至 walk-15.png 顺序循环，每帧 50 毫秒，一轮 800 毫秒。
各目录 strip.png 为该方向横向序列图。
atlas.png：1536 × 384，16 列 × 4 行，行顺序上、下、左、右。
游戏实际显示时须关闭图像平滑，使用整数倍缩放。

此包是已确认人物画法的动作修订样板，尚未接入正式游戏。
贴图来源于先前生成的透明人物画稿，动画使用项目 Canvas 关节绘制器导出。
角色头部与外套共用固定贴图，腿部关节保持同等长度。
'''
(art / 'README.txt').write_text(readme, encoding='utf-8')
destination = art.parent / 'customer-walk-v3.zip'
with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(art.rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to(art).as_posix())
with ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert len([n for n in archive.namelist() if '/walk-' in n and n.endswith('.png')]) == 64
print(f'Packaged and validated: {destination} ({destination.stat().st_size} bytes)')
