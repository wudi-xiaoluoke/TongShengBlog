package com.tongsheng.blog.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tongsheng.blog.entity.Admin;
import com.tongsheng.blog.mapper.AdminMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 初始管理员初始化器：admin 表为空时，用 BCrypt 加密写入初始账号
 */
@Component
public class AdminInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminInitializer.class);

    private final AdminMapper adminMapper;
    private final AdminProperties adminProperties;
    private final BCryptPasswordEncoder passwordEncoder;

    public AdminInitializer(AdminMapper adminMapper, AdminProperties adminProperties,
                            BCryptPasswordEncoder passwordEncoder) {
        this.adminMapper = adminMapper;
        this.adminProperties = adminProperties;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        Long count = adminMapper.selectCount(
                new LambdaQueryWrapper<Admin>().eq(Admin::getUsername, adminProperties.getUsername()));
        if (count != null && count > 0) {
            return;
        }
        Admin admin = new Admin();
        admin.setUsername(adminProperties.getUsername());
        admin.setPassword(passwordEncoder.encode(adminProperties.getInitPassword()));
        admin.setNickname("同生");
        adminMapper.insert(admin);
        log.info("已创建初始管理员账号：{}，初始密码：{}（请登录后尽快修改）",
                adminProperties.getUsername(), adminProperties.getInitPassword());
    }
}
