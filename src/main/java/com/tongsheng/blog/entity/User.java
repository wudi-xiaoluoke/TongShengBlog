package com.tongsheng.blog.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 注册用户（主页粉签注册，未来商城/小游戏共用账号）
 */
@Data
@TableName("user")
public class User {

    /** 用户名长度下限 */
    public static final int USERNAME_MIN = 2;
    /** 用户名长度上限（与表列宽一致） */
    public static final int USERNAME_MAX = 16;
    /** 密码长度下限 */
    public static final int PASSWORD_MIN = 4;
    /** 密码长度上限 */
    public static final int PASSWORD_MAX = 32;

    @TableId(type = IdType.AUTO)
    private Long id;

    private String username;

    /** BCrypt 哈希 */
    private String password;

    private LocalDateTime createdAt;

    private LocalDateTime lastLoginAt;
}
