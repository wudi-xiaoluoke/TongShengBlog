# 蓝衣顾客像素角色样板

用户已确认：参照提供的 RPG 像素角色参考，先制作一位现代日常穿搭顾客的四方向动作样板，确认后再扩展全套。当前工作不替换实际游戏中的全部角色。

美术：棕色短发、蓝色外套、米色内搭、深色裤子、浅色运动鞋，约 2.75 头身，深色轮廓和分层明暗。样板图片由内置 imagegen 制作。动作图为 8 列 × 4 行，行顺序上、下、左、右。动画预览提供暂停、逐帧和速度选择；图片属于风格与动作草稿，最终游戏资源仍须通过循环动作及像素网格的精修验收。

生成提示词：

Create an ORIGINAL professional 2D pixel-art walk-cycle sprite sheet for a modern Chinese snack shop simulation game. Precise game asset, not a poster. One consistent youthful adult male customer throughout: fluffy short chestnut-brown hair with carefully stepped highlights, friendly dark eyes, cobalt/denim blue casual zip jacket over an ivory T-shirt, dark charcoal tapered trousers, cream sneakers with dark soles. Cute but mature RPG sprite proportions, 2.75 heads tall. Detailed handcrafted 16-bit RPG pixel aesthetic, strong dark warm outlines, clear square pixels, clustered 3-tone shadows/highlights, expressive hair tufts, articulated hands/arms/knees, clothing seams. NOT simplistic rectangular stick figures, NOT smooth vector, NOT blurred, NOT realistic 3D. Canvas must be a PERFECT uniform grid of EXACTLY 8 columns and EXACTLY 4 rows, total 32 full-body sprites. Landscape 2:1 overall aspect ratio; each grid cell is square. No margins beyond each cell's internal transparent padding, no gridlines, no titles, no text, no numbers. True TRANSPARENT background, no drawn checkerboard, no shadows. Character centered in every cell with identical scale, head about 22% down from cell top and grounded sole baseline at 88% cell height; never crop any extremity. Each sprite occupies approximately 46% cell width and 68% cell height. Row 1 ONLY walking NORTH / away from camera: back of head and back of blue jacket, no face. Row 2 ONLY walking SOUTH / toward camera: face and front of shirt visible. Row 3 ONLY walking WEST / directly left profile. Row 4 ONLY walking EAST / directly right profile. Across EACH row left to right show consecutive 8 frames of ONE smooth looping natural relaxed walk cycle: left foot contact, down/recoil, passing, up, right foot contact, down/recoil, passing, up. Opposite arm and leg swing together; shoulder and pelvis rotate subtly; consistent thigh and shin lengths, real knee flexion, subtle 1-pixel body rise/fall. Feet separate clearly on contact frames; bend recovery knee on passing frames. Same clothes, same hair, same limb lengths, same design in all 32 cells. Pixel edges crisp, high-quality readable silhouettes like detailed indie RPG adventurer sprite packs, but exclusively modern everyday clothing, no fantasy accessories.

第二次编辑：保持人物与 8×4 布局，补充左右脚交替、并脚经过姿态和膝部弯曲。

第三次编辑：仅移除生成的棋盘格背景，要求真正透明 PNG，保持人物姿态与位置。

验证结果：第三次背景编辑仍返回不透明棋盘格图，透明像素断言失败。当前交付明确是带背景的预览草稿，不承诺正式精灵图的透明性和完整步态质量。预览仍可播放四方向、暂停和逐帧查看。源图片完整保留。
