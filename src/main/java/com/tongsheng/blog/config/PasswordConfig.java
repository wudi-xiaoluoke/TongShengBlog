package com.tongsheng.blog.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * 密码加密器配置（仅 BCrypt，不启用完整 Spring Security）
 */
@Configuration
public class PasswordConfig {

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
