#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorKind {
    BadRequest,
    Unauthorized,
    Forbidden,
    NotFound,
    Conflict,
    UnprocessableEntity,
    FailedDependency,
    Internal,
}

impl ErrorKind {
    pub fn default_error_name(self) -> &'static str {
        match self {
            ErrorKind::BadRequest => "BAD_REQUEST",
            ErrorKind::Unauthorized => "UNAUTHORIZED",
            ErrorKind::Forbidden => "FORBIDDEN",
            ErrorKind::NotFound => "NOT_FOUND",
            ErrorKind::Conflict => "CONFLICT",
            ErrorKind::UnprocessableEntity => "UNPROCESSABLE_ENTITY",
            ErrorKind::FailedDependency => "FAILED_DEPENDENCY",
            ErrorKind::Internal => "INTERNAL_SERVER_ERROR",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DomainError {
    pub kind: ErrorKind,
    pub message: String,
    pub code: Option<&'static str>,
    pub error_name: Option<&'static str>,
}

impl DomainError {
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            code: None,
            error_name: None,
        }
    }

    pub fn with_code(mut self, code: &'static str) -> Self {
        self.code = Some(code);
        self
    }

    pub fn with_error_name(mut self, error_name: &'static str) -> Self {
        self.error_name = Some(error_name);
        self
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::BadRequest, message)
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Unauthorized, message)
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Forbidden, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::NotFound, message)
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Conflict, message)
    }

    pub fn unprocessable(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::UnprocessableEntity, message)
    }

    pub fn failed_dependency(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::FailedDependency, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Internal, message)
    }

    pub fn error_name(&self) -> &'static str {
        self.error_name
            .unwrap_or_else(|| self.kind.default_error_name())
    }
}
