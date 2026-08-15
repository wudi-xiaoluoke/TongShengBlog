package com.tongsheng.blog.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 管理端配置：初始账号 + 防暴力登录
 */
@Data
@Component
@ConfigurationProperties(prefix = "admin")
public class AdminProperties {

    /** 初始管理员用户名（首次启动写入 admin 表） */
    private String username = "admin";

    /** 初始密码（仅首次启动使用，登录后请尽快修改） */
    private String initPassword = "tongsheng2026";

    /** 连续失败多少次触发锁定 */
    private int loginFailLimit = 5;

    /** 锁定分钟数 */
    private int loginLockMinutes = 10;
}
