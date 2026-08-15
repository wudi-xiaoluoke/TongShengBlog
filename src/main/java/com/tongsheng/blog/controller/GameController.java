package com.tongsheng.blog.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * 像素零食店经营小游戏页面。
 */
@Controller
public class GameController {

    @GetMapping("/game")
    public String game() {
        return "game/index";
    }
}
