package com.tongsheng.blog.controller;

import com.tongsheng.blog.entity.User;
import com.tongsheng.blog.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.regex.Pattern;

/**
 * 注册/登录 API：主页粉签使用，会话存 servlet session。
 *
 * <p>登录态约定：session 属性 {@link #SESSION_USER_ID} 存用户 ID。
 * 游戏云存档等后续接口都从这里取当前用户。
 */
@RestController
@RequestMapping("/api/auth")
public class AuthApiController {

    /** 注册/登录请求体 */
    public record Credentials(String username, String password) {
    }

    public static final String SESSION_USER_ID = "userId";
    private static final Pattern FORBIDDEN = Pattern.compile("[\\r\\n<>]");

    private final UserService userService;

    public AuthApiController(UserService userService) {
        this.userService = userService;
    }

    /** 当前登录用户（未登录返回 {user: null}；Map.of 不允许 null 值，这里用可空构造） */
    @GetMapping("/me")
    public Map<String, Object> me(HttpSession session) {
        User user = currentUser(session);
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("user", user == null ? null : Map.of(
                "id", user.getId(),
                "username", safe(user.getUsername())
        ));
        return result;
    }

    /** 名字是否已注册：粉签「签到」用——老名字弹层停「登录」签，新名字停「登记」签 */
    @GetMapping("/exists")
    public Map<String, Object> exists(@RequestParam String name) {
        String username = name == null ? "" : name.trim();
        return Map.of("exists", !username.isEmpty() && userService.findByUsername(username) != null);
    }

    /**
     * 签到：名字没注册过 → 注册并登录；已注册 → 校验密码登录。
     * 一个入口，匹配粉签「写下你的名字」的极简交互。
     */
    @PostMapping("/signin")
    public ResponseEntity<Map<String, Object>> signin(@RequestBody Credentials body, HttpSession session) {
        String username = body.username() == null ? "" : body.username().trim();
        String password = body.password() == null ? "" : body.password();
        if (username.isEmpty() || password.isEmpty()) {
            return bad("名字和密码都要填哦");
        }

        User user = userService.login(username, password);
        if (user != null) {
            session.setAttribute(SESSION_USER_ID, user.getId());
            return ok(user, "欢迎回来，" + safe(user.getUsername()) + "～");
        }

        // 登录失败：可能是新名字 → 尝试注册
        try {
            user = userService.register(username, password);
        } catch (IllegalArgumentException e) {
            return bad(e.getMessage());
        }
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("ok", false, "error", "这个名字已经有人用啦，密码不对的话就进不去咯"));
        }
        session.setAttribute(SESSION_USER_ID, user.getId());
        return ok(user, "登记好啦，" + safe(user.getUsername()) + "！欢迎来到小店～");
    }

    /** 退出登录 */
    @PostMapping("/logout")
    public Map<String, Object> logout(HttpSession session) {
        session.removeAttribute(SESSION_USER_ID);
        return Map.of("ok", true);
    }

    private User currentUser(HttpSession session) {
        Object id = session.getAttribute(SESSION_USER_ID);
        return id instanceof Long userId ? userService.findById(userId) : null;
    }

    private ResponseEntity<Map<String, Object>> ok(User user, String message) {
        return ResponseEntity.ok(Map.of(
                "ok", true,
                "message", message,
                "user", Map.of("id", user.getId(), "username", safe(user.getUsername()))
        ));
    }

    private ResponseEntity<Map<String, Object>> bad(String message) {
        return ResponseEntity.badRequest().body(Map.of("ok", false, "error", message));
    }

    /** 用户名要进 JSON 响应和问候语，去掉控制字符/尖括号防注入 */
    private String safe(String username) {
        return FORBIDDEN.matcher(username).replaceAll("");
    }

    /** 供其他 controller 取当前用户 */
    public static User currentUser(HttpServletRequest request, UserService userService) {
        Object id = request.getSession(false) == null
                ? null
                : request.getSession(false).getAttribute(SESSION_USER_ID);
        return id instanceof Long userId ? userService.findById(userId) : null;
    }
}
