package com.tongsheng.blog.dto;

import java.util.ArrayList;
import java.util.List;

/**
 * 手账档案馆：摊开的一组书页 = 左右两页。
 * 左页较新、右页较旧；月份总数为奇数时最后一组只有左页（右页为封底）。
 *
 * @param left  左页（较新的月份，恒非空）
 * @param right 右页（较旧的月份，可为 null）
 */
public record Spread(MonthGroup left, MonthGroup right) {

    public boolean hasRight() {
        return right != null;
    }

    /** 把月份列表（倒序）两两配对成书页组 */
    public static List<Spread> pairUp(List<MonthGroup> months) {
        List<Spread> spreads = new ArrayList<>();
        for (int i = 0; i < months.size(); i += 2) {
            MonthGroup left = months.get(i);
            MonthGroup right = (i + 1 < months.size()) ? months.get(i + 1) : null;
            spreads.add(new Spread(left, right));
        }
        return spreads;
    }
}
