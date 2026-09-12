package com.tongsheng.blog.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tongsheng.blog.entity.GameSave;
import com.tongsheng.blog.entity.User;
import com.tongsheng.blog.mapper.GameSaveMapper;
import com.tongsheng.blog.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 零食店云存档 API：登录用户的进度存服务端，换设备也能续档。
 *
 * <p>存档体是前端 serializeState 产出的 JSON 字符串（含版本号），
 * 服务端只做透传存储与大小限制，不解析游戏逻辑。
 */
@RestController
@RequestMapping("/api/game")
public class GameSaveApiController {

    /** 单份存档上限 256KB（游戏状态含排面/订单/统计，远小于此值） */
    private static final int MAX_SAVE_BYTES = 256 * 1024;

    private final GameSaveMapper gameSaveMapper;
    private final UserService userService;

    public GameSaveApiController(GameSaveMapper gameSaveMapper, UserService userService) {
        this.gameSaveMapper = gameSaveMapper;
        this.userService = userService;
    }

    /** 拉取云存档：没登录返回 401；登录但没有云端存档返回 {save: null} */
    @GetMapping("/save")
    public ResponseEntity<Map<String, Object>> load(HttpServletRequest request) {
        User user = AuthApiController.currentUser(request, userService);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("ok", false, "error", "未登录"));
        }
        GameSave save = gameSaveMapper.selectById(user.getId());
        return ResponseEntity.ok(Map.of(
                "ok", true,
                "save", save == null ? null : Map.of(
                        "stateJson", save.getStateJson(),
                        "updatedAt", save.getUpdatedAt().toString()
                )
        ));
    }

    /** 覆盖式保存云存档 */
    @PutMapping("/save")
    public ResponseEntity<Map<String, Object>> save(@RequestBody Map<String, String> body,
                                                    HttpServletRequest request) {
        User user = AuthApiController.currentUser(request, userService);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("ok", false, "error", "未登录"));
        }
        String stateJson = body.get("stateJson");
        if (stateJson == null || stateJson.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "存档内容为空"));
        }
        if (stateJson.length() > MAX_SAVE_BYTES) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "存档太大了"));
        }
        GameSave save = gameSaveMapper.selectOne(new LambdaQueryWrapper<GameSave>()
                .eq(GameSave::getUserId, user.getId()));
        if (save == null) {
            save = new GameSave();
            save.setUserId(user.getId());
            save.setStateJson(stateJson);
            save.setUpdatedAt(LocalDateTime.now());
            gameSaveMapper.insert(save);
        } else {
            save.setStateJson(stateJson);
            save.setUpdatedAt(LocalDateTime.now());
            gameSaveMapper.updateById(save);
        }
        return ResponseEntity.ok(Map.of("ok", true, "updatedAt", save.getUpdatedAt().toString()));
    }
}
