package com.tongsheng.blog.config;

import com.tongsheng.blog.interceptor.AdminLoginInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ContentNegotiationConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web 配置：注册管理端登录拦截器
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AdminLoginInterceptor adminLoginInterceptor;

    public WebConfig(AdminLoginInterceptor adminLoginInterceptor) {
        this.adminLoginInterceptor = adminLoginInterceptor;
    }

    @Override
    public void configureContentNegotiation(ContentNegotiationConfigurer configurer) {
        configurer.favorPathExtension(true)
                .mediaType("mjs", MediaType.parseMediaType("text/javascript"));
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(adminLoginInterceptor)
                .addPathPatterns("/admin/**")
                .excludePathPatterns("/admin/login");
    }
}
