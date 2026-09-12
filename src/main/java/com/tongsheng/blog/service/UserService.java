package com.tongsheng.blog.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tongsheng.blog.entity.User;
import com.tongsheng.blog.mapper.UserMapper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.regex.Pattern;

/**
 * 注册用户服务：粉签注册/登录，未来商城/小游戏共用
 */
@Service
public class UserService {

    /** 用户名：2-16 位中文/英文/数字/下划线 */
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[\\u4e00-\\u9fa5A-Za-z0-9_]{2,16}$");

    private final UserMapper userMapper;
    private final BCryptPasswordEncoder passwordEncoder;

    public UserService(UserMapper userMapper, BCryptPasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 注册新用户。用户名已存在时返回 null（前端转为「用这个名字登录」的提示）。
     */
    public User register(String username, String password) {
        String name = normalizeUsername(username);
        validate(name, password);
        if (findByUsername(name) != null) {
            return null;
        }
        User user = new User();
        user.setUsername(name);
        user.setPassword(passwordEncoder.encode(password));
        user.setCreatedAt(LocalDateTime.now());
        userMapper.insert(user);
        return user;
    }

    /**
     * 登录：用户名不存在或密码错误都返回 null。
     */
    public User login(String username, String password) {
        String name = normalizeUsername(username);
        if (name == null || password == null || password.isEmpty()) {
            return null;
        }
        User user = findByUsername(name);
        if (user == null || !passwordEncoder.matches(password, user.getPassword())) {
            return null;
        }
        user.setLastLoginAt(LocalDateTime.now());
        userMapper.updateById(user);
        return user;
    }

    /** 按用户名找用户 */
    public User findByUsername(String username) {
        String name = normalizeUsername(username);
        if (name == null) return null;
        return userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, name));
    }

    /** 按 ID 找用户 */
    public User findById(Long id) {
        return id == null ? null : userMapper.selectById(id);
    }

    /** 最近注册/来过的用户（主页来客名册） */
    public List<User> recentVisitors(int limit) {
        return userMapper.selectList(new LambdaQueryWrapper<User>()
                .orderByDesc(User::getLastLoginAt)
                .orderByDesc(User::getId)
                .last("LIMIT " + Math.max(1, Math.min(limit, 50))));
    }

    /** 注册用户总数 */
    public long count() {
        return userMapper.selectCount(null);
    }

    private String normalizeUsername(String username) {
        return username == null ? null : username.trim();
    }

    private void validate(String username, String password) {
        if (username == null || !USERNAME_PATTERN.matcher(username).matches()) {
            throw new IllegalArgumentException("名字要 2-16 位，只能是中文、英文、数字或下划线");
        }
        if (password == null || password.length() < User.PASSWORD_MIN || password.length() > User.PASSWORD_MAX) {
            throw new IllegalArgumentException("密码要 " + User.PASSWORD_MIN + "-" + User.PASSWORD_MAX + " 位");
        }
    }
}
