from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parents[1]
art = root / 'src/main/resources/static/images/game/cast'
specs = json.loads((root / 'docs/superpowers/specs/customer-cast-prompts.json').read_text(encoding='utf-8'))
readme = '''同生零食铺 · 混合职业顾客 第一组
8 位角色：弓箭手、盗贼、神官、赛博士兵、机器人、哥布林、史莱姆、医生。
每位角色 4 个方向 × 16 帧，单帧透明 PNG 为 96×96，脚底基准 (48,91)。
每帧 50ms，一轮 800ms。人形使用定稿行走动作，史莱姆使用弹跳形变。
atlas.png：1536×384，16 列×4 行，方向顺序 north/south/west/east（上/下/左/右）。
方向目录内 walk-00.png 至 walk-15.png 为序列帧，strip.png 为横向方向图。
source.png 为内置 imagegen 生成的原始四面贴图，prompt.txt 为生成说明。
game-atlas.png：1536×576，前四行为行走，第五行站定、第六行取货/结账，各四列按方向排列。
game-sprites.json 记录游戏图集布局；方向目录内另有 idle.png 和 reach.png。
正式游戏根据移动与交互状态选择姿态，以最近邻方式显示像素角色。
'''
for spec in specs:
    folder = art / spec['id']
    assert len(list(folder.glob('*/walk-*.png'))) == 64, spec['id']
    (folder / 'README.txt').write_text(readme, encoding='utf-8')
    (folder / 'prompt.txt').write_text(spec['prompt'], encoding='utf-8')
    with ZipFile(art / (spec['id'] + '.zip'), 'w', ZIP_DEFLATED) as archive:
        for file in sorted(folder.rglob('*')):
            if file.is_file():
                archive.write(file, file.relative_to(folder).as_posix())
        archive.write(art / 'sources' / (spec['id'] + '.png'), 'source.png')
    with ZipFile(art / (spec['id'] + '.zip')) as archive:
        assert archive.testzip() is None
with ZipFile(art.parent / 'cast-all.zip', 'w', ZIP_DEFLATED) as archive:
    archive.writestr('README.txt', readme)
    for spec in specs:
        folder = art / spec['id']
        for file in sorted(folder.rglob('*')):
            if file.is_file():
                archive.write(file, file.relative_to(art).as_posix())
        archive.write(art / 'sources' / (spec['id'] + '.png'), spec['id'] + '/source.png')
with ZipFile(art.parent / 'cast-all.zip') as archive:
    assert archive.testzip() is None
    assert len([name for name in archive.namelist() if '/walk-' in name and name.endswith('.png')]) == 512
print('PASS: 8 character ZIPs and full cast ZIP, 512 animation frames, original art and prompts included.')
