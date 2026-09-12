package com.tongsheng.blog.service;

import com.tongsheng.blog.config.TrackingProperties;
import org.springframework.stereotype.Service;

import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * 回执号查询限流（内存按 IP）：时间窗口内最多 N 次，防暴力枚举回执号
 */
@Service
public class TrackingRateLimitService {

    private final TrackingProperties props;
    private final Map<String, Deque<Long>> records = new ConcurrentHashMap<>();

    public TrackingRateLimitService(TrackingProperties props) {
        this.props = props;
    }

    /** 当前 IP 是否允许查询（允许则记录本次查询时间） */
    public boolean allow(String ip) {
        long now = System.currentTimeMillis();
        long windowMs = props.getRateLimitMinutes() * 60_000L;
        Deque<Long> deque = records.computeIfAbsent(ip, k -> new ConcurrentLinkedDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && now - deque.peekFirst() > windowMs) {
                deque.pollFirst();
            }
            if (deque.size() >= props.getRateLimitCount()) {
                return false;
            }
            deque.addLast(now);
            return true;
        }
    }
}
