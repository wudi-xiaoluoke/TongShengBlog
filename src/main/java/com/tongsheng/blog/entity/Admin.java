package com.tongsheng.blog.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 管理员实体（单账号）
 */
@Data
@TableName("admin")
public class Admin {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String username;

    /** BCrypt 哈希 */
    private String password;

    private String nickname;

    private LocalDateTime createdAt;
}
