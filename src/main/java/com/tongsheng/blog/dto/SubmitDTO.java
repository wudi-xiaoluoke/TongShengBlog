package com.tongsheng.blog.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 访客投稿表单
 */
@Data
public class SubmitDTO {

    @NotBlank(message = "请留下你的昵称")
    @Size(max = 50, message = "昵称最长 50 个字")
    private String nickname;

    @NotBlank(message = "请写个标题")
    @Size(max = 100, message = "标题最长 100 个字")
    private String title;

    @NotBlank(message = "内容不能为空")
    @Size(max = 5000, message = "内容最长 5000 个字")
    private String content;

    /** 分类ID（null 表示无分类） */
    private Long categoryId;
}
