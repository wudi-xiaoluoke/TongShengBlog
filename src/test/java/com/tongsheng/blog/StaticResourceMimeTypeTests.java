package com.tongsheng.blog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class StaticResourceMimeTypeTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void servesJavaScriptModulesWithExecutableMimeType() throws Exception {
        mockMvc.perform(get("/js/game/main.mjs"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", startsWith("text/javascript")));
    }
}
