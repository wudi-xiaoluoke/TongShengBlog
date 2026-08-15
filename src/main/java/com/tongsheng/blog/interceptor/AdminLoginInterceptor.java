package com.tongsheng.blog.interceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 管理端登录拦截器：未登录访问 /admin/** 一律跳转登录页
 */
@Component
public class AdminLoginInterceptor implements HandlerInterceptor {

    /** session 中管理员键名 */
    public static final String SESSION_ADMIN = "adminUser";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        Object admin = request.getSession().getAttribute(SESSION_ADMIN);
        if (admin == null) {
            response.sendRedirect("/admin/login");
            return false;
        }
        return true;
    }
}
