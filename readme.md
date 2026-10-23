## 插件作用
在设置页维护一组全局提示词（可单条开关），并作为系统提示词的用户层 section 注入。

## 使用
```sh
# 安装
dsh plugin --profile web add https://github.com/nsnans/dsh-pormpt-global

# 移除
dsh plugin --profile web remove dsh-pormpt-global
```

## 本地开发
```sh
# 安装
dsh plugin --profile web add .
```

## 致谢
- [runfali/dsh-prompt-injector](https://github.com/runfali/dsh-prompt-injector.git)
- [zangxx66/dsh-prompt-setting](https://github.com/zangxx66/dsh-prompt-setting)