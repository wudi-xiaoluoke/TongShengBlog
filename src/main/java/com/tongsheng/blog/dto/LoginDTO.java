package com.tongsheng.blog.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 管理端登录表单
 */
@Data
public class LoginDTO {

    @NotBlank(message = "请输入用户名")
    private String username;

    @NotBlank(message = "请输入密码")
    private String password;
}
