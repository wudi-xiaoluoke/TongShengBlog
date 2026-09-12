package com.tongsheng.blog.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 零食店云存档（一个用户一份，覆盖式保存）
 */
@Data
@TableName("game_save")
public class GameSave {

    /** 与用户一对一，直接用 userId 作主键 */
    @TableId
    private Long userId;

    private String stateJson;

    private LocalDateTime updatedAt;
}
