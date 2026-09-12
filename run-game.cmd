@echo off
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot
set MAVEN_HOME=E:\maven\apache-maven-3.9.16
cd /d C:\Users\伟嘉\WorkBuddy\Worktrees\Tongshengbolg\main-b59f4cb7
call "E:\maven\apache-maven-3.9.16\bin\mvn.cmd" spring-boot:run "-Dspring-boot.run.jvmArguments=-Dserver.port=8081" >> sb-run2.log 2>&1
