provider "helm" {
  install_tiller = true
  service_account = "tiller"
  namespace = "kube-system"

	kubernetes {
    host                   = "${var.cluster_host}"
    client_certificate     = "${var.cluster_client_certificate}"
    client_key             = "${var.cluster_client_key}"
    cluster_ca_certificate = "${var.cluster_ca_certificate}"
  }
}

provider "kubernetes" {
  host                   = "${var.cluster_host}"
  client_certificate     = "${var.cluster_client_certificate}"
  client_key             = "${var.cluster_client_key}"
  cluster_ca_certificate = "${var.cluster_ca_certificate}"
}

resource "kubernetes_service_account" "tiller" {
  metadata {
    name      = "tiller"
    namespace = "kube-system"
  }
}

resource "kubernetes_cluster_role_binding" "tiller" {
  metadata {
    name = "tiller"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "cluster-admin"
  }

  # api_group has to be empty because of a bug:
  # https://github.com/terraform-providers/terraform-provider-kubernetes/issues/204
  subject {
    api_group = ""
    kind      = "ServiceAccount"
    name      = "tiller"
    namespace = "kube-system"
  }
}

resource "helm_release" "fellrace_finder_server" {
  name       = "fellrace-finder-server"
  chart      = "fellrace-finder-server"
  repository = "https://raw.githubusercontent.com/blairg/fellrace-finder-helm/master/"
  values     = ["${file("../k8s/fellrace-finder-server/values.yaml")}"]
  version    = "0.1.0"

  set {
    name  = "service.type"
    value = "NodePort"
  }

  set {
    name  = "image.command"
    value = "dev-server"
  }

  set {
    name  = "image.repository"
    value = "blairguk/fellrace-finder-server"
  }

  set {
    name  = "image.tag"
    value = "latest"
  }

  set {
    name  = "environment.mongo_url"
    value = "${base64decode(var.mongo_url)}"
  }
}