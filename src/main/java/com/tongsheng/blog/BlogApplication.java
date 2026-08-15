package com.tongsheng.blog;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 同生的手账本 — 个人博客启动类
 */
@SpringBootApplication

@MapperScan("com.tongsheng.blog.mapper")
public class BlogApplication {

    public static void main(String[] args) {
        SpringApplication.run(BlogApplication.class, args);
    }
}
